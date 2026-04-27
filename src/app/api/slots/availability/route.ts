import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSlotsForDate, composeAvailability } from "@/lib/slots";
import type { ShopHours } from "@/lib/slots";

export const runtime = "nodejs";

const Query = z.object({
  shopId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const ACTIVE_STATUSES = ["SCHEDULED", "BUNDLED", "PRINTED", "READY", "COLLECTED", "PENDING_PAYMENT"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({
    shopId: url.searchParams.get("shopId"),
    date: url.searchParams.get("date"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: shop, error: shopErr } = await admin
    .from("shops")
    .select("id, hours_json, slot_duration_min, max_per_slot, campus_id, campuses(timezone)")
    .eq("id", parsed.data.shopId)
    .single();
  if (shopErr || !shop) {
    return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  }

  const tz =
    (shop as unknown as { campuses?: { timezone?: string } }).campuses?.timezone ?? "Asia/Kolkata";

  // Date in shop timezone → use noon to avoid DST edges, then buildSlotsForDate computes
  // hours from that local date.
  const dateUtcAnchor = new Date(`${parsed.data.date}T12:00:00Z`);

  const slots = buildSlotsForDate({
    hours: shop.hours_json as ShopHours,
    date: dateUtcAnchor,
    slotDurationMin: shop.slot_duration_min,
    tz,
  });

  if (slots.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  const firstIso = slots[0].iso;
  const lastIso = slots[slots.length - 1].iso;

  const { data: jobs } = await admin
    .from("jobs")
    .select("slot_time, status")
    .eq("shop_id", parsed.data.shopId)
    .in("status", ACTIVE_STATUSES)
    .gte("slot_time", firstIso)
    .lte("slot_time", lastIso);

  const usage: Record<string, number> = {};
  for (const j of jobs ?? []) {
    const iso = new Date(j.slot_time).toISOString();
    usage[iso] = (usage[iso] ?? 0) + 1;
  }

  const { data: blocks } = await admin
    .from("slot_blocks")
    .select("slot_time")
    .eq("shop_id", parsed.data.shopId)
    .gte("slot_time", firstIso)
    .lte("slot_time", lastIso);

  const blockedSet = new Set<string>();
  for (const b of blocks ?? []) {
    blockedSet.add(new Date(b.slot_time).toISOString());
  }

  const composed = composeAvailability({
    slots,
    capacity: shop.max_per_slot,
    usageBySlotIso: usage,
    blockedSlotIsos: blockedSet,
    now: new Date(),
  });

  // Strip non-serializable Date and return label/iso/etc.
  const payload = composed.map((s) => ({
    iso: s.iso,
    label: s.label,
    capacity: s.capacity,
    used: s.used,
    isPast: s.isPast,
    isBlocked: s.isBlocked,
    isFull: s.isFull,
  }));

  return NextResponse.json({ slots: payload });
}
