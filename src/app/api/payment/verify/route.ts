import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { nextToken } from "@/lib/tokens";
import { priceJob } from "@/lib/pricing";
import { FileSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

const Body = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
  jobDraftId: z.string(),
  shopId: z.string().uuid(),
  slotTime: z.string(),
  files: z.array(
    FileSettingsSchema.extend({
      filename: z.string(),
      storagePath: z.string(),
    })
  ).min(1),
  notes: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const admin = createAdminClient();

  const ok = verifyCheckoutSignature({
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });

  if (!ok) {
    await admin.from("payment_audit").insert({
      event_type: "VERIFY_FAILED_SIGNATURE",
      payload_json: { ...body, userId: user.id },
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Re-price server-side (tamper resistance)
  const { data: shop } = await admin
    .from("shops")
    .select("pricing_json, premium_percent, gst_enabled, printer_config_json")
    .eq("id", body.shopId)
    .single();
  if (!shop) return NextResponse.json({ error: "shop missing" }, { status: 404 });

  const { data: gst } = await admin.from("app_settings").select("value_json").eq("key", "gst_percent").single();
  const gstPercent = Number(gst?.value_json ?? 18);

  const cfg = shop.printer_config_json as any;
  const duplexCapableFallback = cfg.printers.some((p: any) => p.supports_duplex);

  const price = priceJob({
    files: body.files,
    pricing: shop.pricing_json,
    premiumPercent: Number(shop.premium_percent),
    gstEnabled: shop.gst_enabled,
    gstPercent,
    duplexCapableMap: {},
    duplexCapableFallback,
  });

  // Token + insert job within DB-side atomicity
  const slotDate = new Date(body.slotTime);
  const token = await nextToken(body.shopId, slotDate);

  const totalPagesColor = body.files.reduce((s, f) => s + (f.colorMode === "ALL_COLOR" ? f.pageCount : 0), 0);
  const totalPagesBW = body.files.reduce((s, f) => s + (f.colorMode === "ALL_BW" ? f.pageCount : 0), 0);
  const totalPagesPoster = body.files.reduce((s, f) => s + (f.paperType === "POSTER_GLOSSY" ? f.pageCount : 0), 0);

  const { data: job, error: je } = await admin
    .from("jobs")
    .insert({
      user_id: user.id,
      shop_id: body.shopId,
      token,
      slot_time: body.slotTime,
      status: "SCHEDULED",
      total_pages_color: totalPagesColor,
      total_pages_bw: totalPagesBW,
      total_pages_poster: totalPagesPoster,
      total_amount_paise: price.totalPaise,
      premium_amount_paise: price.premiumPaise,
      gst_amount_paise: price.gstPaise,
      razorpay_order_id: body.razorpay_order_id,
      razorpay_payment_id: body.razorpay_payment_id,
      razorpay_signature: body.razorpay_signature,
      notes: body.notes ?? null,
    })
    .select("id, token, slot_time")
    .single();
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });

  // Insert files
  const fileRows = body.files.map((f, idx) => ({
    job_id: job.id,
    filename: f.filename,
    storage_path: f.storagePath,
    page_count: f.pageCount,
    paper_type: f.paperType,
    paper_size: f.paperSize,
    color_mode: f.colorMode,
    color_pages_spec: f.colorPagesSpec ?? null,
    sides: f.sides,
    layout: f.layout,
    copies: f.copies,
    page_range_spec: f.pageRangeSpec ?? null,
    orientation: f.orientation,
    settings_json: f,
    order_index: idx,
  }));
  const { error: fe } = await admin.from("job_files").insert(fileRows);
  if (fe) return NextResponse.json({ error: fe.message }, { status: 500 });

  await admin.from("payment_audit").insert({
    job_id: job.id,
    event_type: "PAYMENT_VERIFIED",
    payload_json: { ...body, userId: user.id, totalPaise: price.totalPaise },
  });

  return NextResponse.json({ token: job.token, slotTime: job.slot_time, jobId: job.id });
}
