import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextToken } from "@/lib/tokens";
import { priceJob } from "@/lib/pricing";
import { FileSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * DEV-ONLY shortcut for the full payment loop.
 * Enabled when PRINTSWIPE_BYPASS_PAY=true on the server.
 * Skips Razorpay signature verification and marks the job SCHEDULED with a
 * synthetic order/payment id so downstream merchant flow can be tested.
 */
const Body = z.object({
  jobDraftId: z.string(),
  shopId: z.string().uuid(),
  slotTime: z.string(),
  files: z.array(
    z.intersection(
      FileSettingsSchema,
      z.object({ filename: z.string(), storagePath: z.string() })
    )
  ).min(1),
  notes: z.string().nullable().optional(),
});

function bypassEnabled(): boolean {
  return (
    process.env.PRINTSWIPE_BYPASS_PAY === "true" ||
    process.env.DEV_PAYMENT_BYPASS === "true" ||
    process.env.NEXT_PUBLIC_PRINTSWIPE_BYPASS_PAY === "true"
  );
}

export async function POST(req: Request) {
  if (!bypassEnabled()) {
    return NextResponse.json({ error: "dev bypass disabled" }, { status: 403 });
  }

  const supa = createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const admin = createAdminClient();

  const { data: shop } = await admin
    .from("shops")
    .select("pricing_json, premium_percent, gst_enabled, printer_config_json")
    .eq("id", body.shopId)
    .single();
  if (!shop) return NextResponse.json({ error: "shop missing" }, { status: 404 });

  const { data: gst } = await admin.from("app_settings").select("value_json").eq("key", "gst_percent").single();
  const gstPercent = Number(gst?.value_json ?? 18);
  const cfg = shop.printer_config_json as { printers: { supports_duplex: boolean }[] };
  const duplexCapableFallback = cfg.printers.some((p) => p.supports_duplex);

  const price = priceJob({
    files: body.files,
    pricing: shop.pricing_json,
    premiumPercent: Number(shop.premium_percent),
    gstEnabled: shop.gst_enabled,
    gstPercent,
    duplexCapableMap: {},
    duplexCapableFallback,
  });

  const slotDate = new Date(body.slotTime);
  const token = await nextToken(body.shopId, slotDate);

  const totalPagesColor = body.files.reduce((s, f) => s + (f.colorMode === "ALL_COLOR" ? f.pageCount : 0), 0);
  const totalPagesBW = body.files.reduce((s, f) => s + (f.colorMode === "ALL_BW" ? f.pageCount : 0), 0);
  const totalPagesPoster = body.files.reduce((s, f) => s + (f.paperType === "POSTER_GLOSSY" ? f.pageCount : 0), 0);

  const fakeOrderId = `order_DEV_${Date.now()}`;
  const fakePaymentId = `pay_DEV_${Date.now()}`;

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
      razorpay_order_id: fakeOrderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: "DEV_BYPASS",
      notes: body.notes ?? null,
    })
    .select("id, token, slot_time")
    .single();
  if (je) return NextResponse.json({ error: je.message }, { status: 500 });

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
    event_type: "DEV_BYPASS",
    payload_json: { ...body, userId: user.id, totalPaise: price.totalPaise, fakeOrderId, fakePaymentId },
  });

  return NextResponse.json({ token: job.token, slotTime: job.slot_time, jobId: job.id, devBypass: true });
}

// Public read so the client knows whether to show the bypass button.
export async function GET() {
  return NextResponse.json(
    {
      enabled: bypassEnabled(),
      // expose which env name fired for diagnostics
      via: process.env.PRINTSWIPE_BYPASS_PAY === "true"
        ? "PRINTSWIPE_BYPASS_PAY"
        : process.env.DEV_PAYMENT_BYPASS === "true"
          ? "DEV_PAYMENT_BYPASS"
          : process.env.NEXT_PUBLIC_PRINTSWIPE_BYPASS_PAY === "true"
            ? "NEXT_PUBLIC_PRINTSWIPE_BYPASS_PAY"
            : null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "CDN-Cache-Control": "no-store",
      },
    }
  );
}
