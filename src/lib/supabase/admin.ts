import { createClient } from "@supabase/supabase-js";

// Service-role client. Server-only. Never import from client components.
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("admin client used in browser");
  }
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
