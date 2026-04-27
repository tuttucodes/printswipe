import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
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

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = sb
    .from("jobs")
    .select(
      `id, token, slot_time, status, bin_number, total_amount_paise,
       created_at, user_id,
       profiles:user_id ( name, phone )`
    )
    .eq("shop_id", merchant.shop_id)
    .order("slot_time", { ascending: true });

  if (status) query = query.eq("status", status);
  if (from) query = query.gte("slot_time", from);
  if (to) query = query.lte("slot_time", to);

  const { data, error } = await query.limit(500);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
