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

  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim().toUpperCase();
  if (!token) {
    return NextResponse.json({ success: false, error: "token required" }, { status: 400 });
  }

  const { data: merchant } = await sb
    .from("merchants")
    .select("shop_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!merchant) {
    return NextResponse.json({ success: false, error: "no shop linked" }, { status: 403 });
  }

  const { data: job, error } = await sb
    .from("jobs")
    .select(
      `id, token, slot_time, status, bin_number, total_amount_paise, collected_at,
       user_id,
       profiles:user_id ( name, phone ),
       job_files ( filename, page_count, paper_type, paper_size, color_mode, copies )`
    )
    .eq("shop_id", merchant.shop_id)
    .eq("token", token)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ success: false, error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: job });
}
