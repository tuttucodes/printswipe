import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpay } from "@/lib/razorpay";
import { priceJob } from "@/lib/pricing";
import { FileSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

const Body = z.object({
  jobDraftId: z.string(),
  shopId: z.string().uuid(),
  slotTime: z.string(),
  files: z.array(FileSettingsSchema).min(1),
});

export async function POST(req: Request) {
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const admin = createAdminClient();
  const { data: shop, error: se } = await admin
    .from("shops")
    .select("pricing_json, premium_percent, gst_enabled, printer_config_json")
    .eq("id", body.data.shopId)
    .single();
  if (se || !shop) return NextResponse.json({ error: "shop not found" }, { status: 404 });

  const { data: gstSetting } = await admin
    .from("app_settings")
    .select("value_json")
    .eq("key", "gst_percent")
    .single();
  const gstPercent = Number(gstSetting?.value_json ?? 18);

  // Server-side recompute. Determine duplex capability from shop's printer config.
  const cfg = shop.printer_config_json as any;
  const duplexCapableFallback = cfg.printers.some((p: any) => p.supports_duplex);

  const result = priceJob({
    files: body.data.files,
    pricing: shop.pricing_json,
    premiumPercent: Number(shop.premium_percent),
    gstEnabled: shop.gst_enabled,
    gstPercent,
    duplexCapableMap: {},
    duplexCapableFallback,
  });

  const rzp = await getRazorpay();
  const order = await rzp.orders.create({
    amount: result.totalPaise,
    currency: "INR",
    receipt: body.data.jobDraftId,
    notes: { shopId: body.data.shopId, userId: user.id, slotTime: body.data.slotTime },
  });

  await admin.from("payment_audit").insert({
    job_id: null,
    event_type: "ORDER_CREATED",
    payload_json: { jobDraftId: body.data.jobDraftId, orderId: order.id, amount: order.amount, userId: user.id },
  });

  return NextResponse.json({
    orderId: order.id,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    amount: order.amount,
    breakdown: result.breakdown,
  });
}
