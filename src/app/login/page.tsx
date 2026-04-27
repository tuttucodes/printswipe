import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginClient } from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; email?: string };
}) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) redirect("/home");

  const { data: campuses } = await sb
    .from("campuses")
    .select("name, allowed_email_domains")
    .eq("is_active", true)
    .order("name");

  return (
    <LoginClient
      supportedCampuses={campuses ?? []}
      errorCode={searchParams.error ?? null}
      attemptedEmail={searchParams.email ?? null}
    />
  );
}
