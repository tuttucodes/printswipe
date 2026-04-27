import { LoginClient } from "./LoginClient";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    // already logged in → home
    const { redirect } = await import("next/navigation");
    redirect("/home");
  }

  const { data: campuses } = await sb
    .from("campuses")
    .select("id, name, city, allowed_email_domains")
    .order("name");

  return <LoginClient campuses={campuses ?? []} />;
}
