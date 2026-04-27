import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const Body = z.object({
  status: z.enum(["PRINTED", "READY", "COLLECTED"]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the job is in merchant's shop
  const { data: job } = await admin
    .from("jobs")
    .select("id, shop_id")
    .eq("id", params.id)
    .single();
  if (!job) {
    return NextResponse.json({ success: false, error: "not found" }, { status: 404 });
  }

  const { data: merchant } = await sb
    .from("merchants")
    .select("shop_id")
    .eq("profile_id", user.id)
    .eq("shop_id", job.shop_id)
    .maybeSingle();
  if (!merchant) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "COLLECTED") {
    update.collected_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("jobs")
    .update(update)
    .eq("id", params.id)
    .select("id, status, collected_at")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}
