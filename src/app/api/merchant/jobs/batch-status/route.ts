import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const Body = z.object({
  jobIds: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(["PRINTED", "READY", "COLLECTED"]),
});

export async function PATCH(req: Request) {
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

  // Verify all jobs belong to merchant's shop(s)
  const { data: jobs } = await admin
    .from("jobs")
    .select("id, shop_id")
    .in("id", parsed.data.jobIds);
  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ success: false, error: "no jobs" }, { status: 404 });
  }

  const shopIds = [...new Set(jobs.map((j) => j.shop_id as string))];
  const { data: merchantLinks } = await sb
    .from("merchants")
    .select("shop_id")
    .eq("profile_id", user.id)
    .in("shop_id", shopIds);
  const allowedShops = new Set((merchantLinks ?? []).map((m) => m.shop_id as string));
  const allAllowed = shopIds.every((s) => allowedShops.has(s));
  if (!allAllowed) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "COLLECTED") {
    update.collected_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("jobs")
    .update(update)
    .in("id", parsed.data.jobIds);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { count: parsed.data.jobIds.length } });
}
