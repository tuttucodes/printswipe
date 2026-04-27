/**
 * Idempotent seed. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 * Run: pnpm seed
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const DEFAULT_PRICING = {
  plain: { bw: { A4: 200, A3: 400 }, color: { A4: 1000, A3: 2000 } },
  poster_glossy: { color: { A4: 5000, A2: 25000 }, bw: { A4: 4000, A2: 20000 } },
  duplex_discount_percent: 15,
  currency: "INR",
};

const DEFAULT_PRINTERS = {
  printers: [
    { id: "p1", label: "HP LaserJet Pro M283", supports_color: false, supported_paper_types: ["PLAIN"], supported_paper_sizes: ["A4", "A3"], supports_duplex: true },
    { id: "p2", label: "Canon ImageRunner C3226i", supports_color: true, supported_paper_types: ["PLAIN"], supported_paper_sizes: ["A4", "A3"], supports_duplex: true },
    { id: "p3", label: "Epson SureColor P700", supports_color: true, supported_paper_types: ["POSTER_GLOSSY"], supported_paper_sizes: ["A4"], supports_duplex: false },
    { id: "p4", label: "Epson SureColor T3170M", supports_color: true, supported_paper_types: ["POSTER_GLOSSY"], supported_paper_sizes: ["A2"], supports_duplex: false },
  ],
  stream_routing: {
    bw_a4: "p1", bw_a3: "p1", color_a4: "p2", color_a3: "p2", poster_a4: "p3", poster_a2: "p4",
  },
};

const DEFAULT_HOURS = {
  mon: { open: "09:00", close: "21:00" },
  tue: { open: "09:00", close: "21:00" },
  wed: { open: "09:00", close: "21:00" },
  thu: { open: "09:00", close: "21:00" },
  fri: { open: "09:00", close: "21:00" },
  sat: { open: "09:00", close: "21:00" },
  sun: { closed: true },
};

const CAMPUSES = [
  { name: "VIT Chennai", city: "Chennai", domains: ["vit.ac.in", "vitstudent.ac.in"] },
  { name: "VIT Vellore", city: "Vellore", domains: ["vit.ac.in", "vitstudent.ac.in"] },
  { name: "IIT Madras", city: "Chennai", domains: ["smail.iitm.ac.in", "iitm.ac.in"] },
  { name: "BITS Pilani", city: "Pilani", domains: ["pilani.bits-pilani.ac.in", "hyderabad.bits-pilani.ac.in"] },
];

const VIT_CHENNAI_SHOPS = ["A", "B", "C", "D"].map((b) => ({
  name: `Block ${b} Prints`,
  location_desc: `Block ${b} ground floor, near food court`,
}));

async function upsertCampus(name: string, city: string, domains: string[]) {
  const { data, error } = await sb
    .from("campuses")
    .upsert({ name, city, allowed_email_domains: domains, timezone: "Asia/Kolkata", is_active: true }, { onConflict: "name" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function upsertShop(campusId: string, name: string, location: string) {
  const { data: existing } = await sb
    .from("shops")
    .select("id")
    .eq("campus_id", campusId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await sb
    .from("shops")
    .insert({
      campus_id: campusId,
      name,
      location_desc: location,
      hours_json: DEFAULT_HOURS,
      slot_duration_min: 15,
      max_per_slot: 8,
      bin_count: 10,
      pricing_json: DEFAULT_PRICING,
      printer_config_json: DEFAULT_PRINTERS,
      premium_percent: 25,
      gst_enabled: false,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function upsertUser(email: string, password: string, role: "student" | "merchant", name: string, phone?: string, campusId?: string) {
  const list = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  let userId = existing?.id;

  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user!.id;
  }

  // Trigger handle_new_user creates the row; ensure fields filled.
  await sb.from("profiles").upsert(
    { id: userId, email: email.toLowerCase(), role, name, phone, campus_id: campusId ?? null },
    { onConflict: "id" }
  );

  return userId!;
}

async function linkMerchant(profileId: string, shopId: string) {
  await sb.from("merchants").upsert({ profile_id: profileId, shop_id: shopId }, { onConflict: "profile_id,shop_id" });
}

async function main() {
  console.log("→ Campuses…");
  const campusRows: Record<string, string> = {};
  for (const c of CAMPUSES) {
    const row = await upsertCampus(c.name, c.city, c.domains);
    campusRows[c.name] = row.id;
    console.log(`  ✓ ${c.name}`);
  }

  console.log("→ Shops…");
  const shopRows: Record<string, string> = {};

  for (const s of VIT_CHENNAI_SHOPS) {
    const row = await upsertShop(campusRows["VIT Chennai"], s.name, s.location_desc);
    shopRows[s.name] = row.id;
    console.log(`  ✓ VIT Chennai / ${s.name}`);
  }

  for (const camp of ["VIT Vellore", "IIT Madras", "BITS Pilani"]) {
    const row = await upsertShop(campusRows[camp], `${camp} Central Prints`, `Main academic block, ground floor`);
    shopRows[`${camp} Central Prints`] = row.id;
    console.log(`  ✓ ${camp} / Central Prints`);
  }

  console.log("→ Merchants…");
  const merchantSeed: Array<[string, string, string]> = [
    ["merchant.blocka@printswipe.test", "Block A Prints", "Anand R."],
    ["merchant.blockb@printswipe.test", "Block B Prints", "Bharath S."],
    ["merchant.blockc@printswipe.test", "Block C Prints", "Chitra V."],
    ["merchant.blockd@printswipe.test", "Block D Prints", "Deepak N."],
    ["merchant.vitvellore@printswipe.test", "VIT Vellore Central Prints", "Eshwar P."],
    ["merchant.iitm@printswipe.test", "IIT Madras Central Prints", "Farah K."],
    ["merchant.bits@printswipe.test", "BITS Pilani Central Prints", "Gautam T."],
  ];
  for (const [email, shopName, name] of merchantSeed) {
    const uid = await upsertUser(email, "Test@1234", "merchant", name);
    await linkMerchant(uid, shopRows[shopName]);
    console.log(`  ✓ ${email} → ${shopName}`);
  }

  console.log("→ Demo students…");
  const demoSeed: Array<[string, string, string, string]> = [
    ["demo1@vitstudent.ac.in", "Demo@1234", "Rahul K.", "+919999999991"],
    ["demo2@vitstudent.ac.in", "Demo@1234", "Priya S.", "+919999999992"],
    ["demo3@vit.ac.in",        "Demo@1234", "Dr. Arjun M.", "+919999999993"],
  ];
  for (const [email, password, name, phone] of demoSeed) {
    await upsertUser(email, password, "student", name, phone, campusRows["VIT Chennai"]);
    console.log(`  ✓ ${email}`);
  }

  console.log("\n✓ Seed complete.\n");
  console.log("Merchant logins (pwd Test@1234):");
  merchantSeed.forEach(([e]) => console.log(`  ${e}`));
  console.log("\nDemo student logins (pwd Demo@1234):");
  demoSeed.forEach(([e]) => console.log(`  ${e}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
