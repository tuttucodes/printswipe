import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MerchantShell } from "@/components/MerchantShell";
import { DashboardClient, type DashboardJob } from "./DashboardClient";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

export const dynamic = "force-dynamic";

export default async function MerchantDashboardPage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/merchant/login");

  // Resolve merchant's shop
  const { data: merchant } = await sb
    .from("merchants")
    .select("shop_id, shops(id, name, bin_count, slot_duration_min, max_per_slot)")
    .eq("profile_id", user.id)
    .single();

  if (!merchant) {
    return (
      <MerchantShell>
        <div className="container py-12">
          <div className="hairline p-6 bg-paper">
            <div className="smallcaps text-ink/60 mb-2">No shop linked</div>
            <h1 className="text-2xl font-bold">
              This account is not linked to any shop yet.
            </h1>
            <p className="mt-2 text-ink/70">
              Contact an administrator to link your merchant profile.
            </p>
          </div>
        </div>
      </MerchantShell>
    );
  }

  const shopId = merchant.shop_id as string;
  const shop = merchant.shops as unknown as {
    id: string;
    name: string;
    bin_count: number;
    slot_duration_min: number;
    max_per_slot: number;
  };

  // IST today range → UTC ISO bounds
  const nowIst = formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
  const fromIso = new Date(`${nowIst}T00:00:00+05:30`).toISOString();
  const toIso = new Date(`${nowIst}T23:59:59+05:30`).toISOString();

  const { data: rows } = await sb
    .from("jobs")
    .select(
      `id, token, slot_time, status, bin_number, total_amount_paise,
       created_at, user_id,
       profiles:user_id ( name, phone ),
       job_files ( paper_type, paper_size, color_mode, page_count, copies )`
    )
    .eq("shop_id", shopId)
    .gte("slot_time", fromIso)
    .lte("slot_time", toIso)
    .order("slot_time", { ascending: true });

  const jobs: DashboardJob[] = (rows ?? []).map((r) => {
    const profile = (r.profiles as unknown) as { name: string | null; phone: string | null } | null;
    const files = (r.job_files as unknown as Array<{
      paper_type: string;
      paper_size: string;
      color_mode: string;
      page_count: number;
      copies: number;
    }>) ?? [];
    return {
      id: r.id as string,
      token: (r.token as string) ?? "",
      slotTime: r.slot_time as string,
      status: r.status as DashboardJob["status"],
      binNumber: (r.bin_number as number | null) ?? null,
      totalAmountPaise: r.total_amount_paise as number,
      studentName: profile?.name ?? "—",
      studentPhone: profile?.phone ?? null,
      fileCount: files.length,
      files: files.map((f) => ({
        paperType: f.paper_type,
        paperSize: f.paper_size,
        colorMode: f.color_mode,
        pageCount: f.page_count,
        copies: f.copies,
      })),
    };
  });

  return (
    <MerchantShell>
      <DashboardClient jobs={jobs} shopId={shopId} shopName={shop.name} binCount={shop.bin_count} />
    </MerchantShell>
  );
}
