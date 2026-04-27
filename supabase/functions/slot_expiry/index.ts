// Supabase Edge Function: slot_expiry
//
// Marks PENDING_PAYMENT jobs older than 30 minutes as EXPIRED so the slot is
// freed and the order can no longer be paid for. Runs every 5 minutes via
// Supabase pg_cron.
//
// Deploy:
//   supabase functions deploy slot_expiry --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const PENDING_TTL_MINUTES = 30;

function envOrThrow(name: string): string {
  // deno-lint-ignore no-explicit-any
  const v = (Deno as any).env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function run(): Promise<{ expired: number }> {
  const supabaseUrl = envOrThrow("SUPABASE_URL");
  const serviceKey = envOrThrow("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const cutoff = new Date(Date.now() - PENDING_TTL_MINUTES * 60_000).toISOString();
  const { data, error } = await client
    .from("jobs")
    .update({ status: "EXPIRED", expires_at: new Date().toISOString() })
    .eq("status", "PENDING_PAYMENT")
    .lt("created_at", cutoff)
    .select("id");

  if (error) throw error;
  return { expired: data?.length ?? 0 };
}

// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve(async (_req: Request) => {
  try {
    const summary = await run();
    console.log("[slot_expiry]", JSON.stringify(summary));
    return new Response(JSON.stringify({ success: true, data: summary }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[slot_expiry] failed:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
