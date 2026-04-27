import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  HoursSchema,
  PricingConfigSchema,
  PrinterConfigSchema,
} from "@/lib/validation";
import { STREAM_KEYS, type PaperType, type PaperSize } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  hours: HoursSchema,
  slotDurationMin: z.number().int().min(5).max(120),
  maxPerSlot: z.number().int().min(1).max(100),
  binCount: z.number().int().min(1).max(200),
  premiumPercent: z.number().min(0).max(100),
  gstEnabled: z.boolean(),
  gstNumber: z.string().max(20),
  pricing: PricingConfigSchema,
  printerConfig: PrinterConfigSchema,
});

export async function PATCH(req: Request) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().formErrors.join(", ") || "invalid body" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  // Validate stream → printer compatibility
  for (const k of STREAM_KEYS) {
    const printerId = body.printerConfig.stream_routing[k];
    const p = body.printerConfig.printers.find((pr) => pr.id === printerId);
    if (!p) {
      return NextResponse.json(
        { success: false, error: `${k}: unknown printer ${printerId}` },
        { status: 400 }
      );
    }
    const isPoster = k.startsWith("poster_");
    const requiredType: PaperType = isPoster ? "POSTER_GLOSSY" : "PLAIN";
    const size = (k.endsWith("_a4") ? "A4" : k.endsWith("_a3") ? "A3" : "A2") as PaperSize;
    if (!p.supported_paper_types.includes(requiredType)) {
      return NextResponse.json(
        { success: false, error: `${p.label} cannot handle ${requiredType}` },
        { status: 400 }
      );
    }
    if (!p.supported_paper_sizes.includes(size)) {
      return NextResponse.json(
        { success: false, error: `${p.label} cannot handle ${size}` },
        { status: 400 }
      );
    }
    if (k.startsWith("color_") && !p.supports_color) {
      return NextResponse.json(
        { success: false, error: `${p.label} cannot print color` },
        { status: 400 }
      );
    }
  }

  // Resolve merchant's shop
  const { data: merchant } = await sb
    .from("merchants")
    .select("shop_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!merchant) {
    return NextResponse.json({ success: false, error: "no shop linked" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("shops")
    .update({
      hours_json: body.hours,
      slot_duration_min: body.slotDurationMin,
      max_per_slot: body.maxPerSlot,
      bin_count: body.binCount,
      premium_percent: body.premiumPercent,
      gst_enabled: body.gstEnabled,
      gst_number: body.gstNumber || null,
      pricing_json: body.pricing,
      printer_config_json: body.printerConfig,
    })
    .eq("id", merchant.shop_id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { ok: true } });
}
