import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Google OAuth callback.
 * 1. Exchange code for session.
 * 2. Match user's email domain to an active campus.
 * 3. If matched: upsert profile.campus_id, redirect to /home (or /profile-setup if phone missing).
 * 4. If not matched: sign out, redirect to /login?error=domain_mismatch&email=...
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/home";
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const sb = createClient();
  const { error: exchangeErr } = await sb.auth.exchangeCodeForSession(code);
  if (exchangeErr) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user || !user.email) {
    await sb.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=no_email`);
  }

  const email = user.email.toLowerCase();
  const domain = email.split("@")[1];

  // Match domain → campus (admin client bypasses RLS for the lookup)
  const admin = createAdminClient();
  const { data: campuses } = await admin
    .from("campuses")
    .select("id, name, allowed_email_domains")
    .eq("is_active", true);

  const matched = (campuses ?? []).find((c) =>
    (c.allowed_email_domains ?? []).map((d: string) => d.toLowerCase()).includes(domain)
  );

  if (!matched) {
    await sb.auth.signOut();
    const params = new URLSearchParams({ error: "domain_mismatch", email });
    return NextResponse.redirect(`${origin}/login?${params}`);
  }

  // Upsert profile with campus_id and Google-provided name (if profile name is empty)
  const googleName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  const { data: existing } = await admin
    .from("profiles")
    .select("name, phone, campus_id")
    .eq("id", user.id)
    .maybeSingle();

  await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email,
        campus_id: matched.id,
        name: existing?.name ?? googleName,
        // phone preserved if already set
        phone: existing?.phone ?? null,
        role: "student",
      },
      { onConflict: "id" }
    );

  const needsPhone = !existing?.phone;
  if (needsPhone) {
    return NextResponse.redirect(`${origin}/profile-setup?next=${encodeURIComponent(next)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
