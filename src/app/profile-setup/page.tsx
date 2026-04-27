import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSetupClient } from "./ProfileSetupClient";

export const dynamic = "force-dynamic";

export default async function ProfileSetupPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("profiles")
    .select("name, phone, campus_id, email, campuses(name)")
    .eq("id", user.id)
    .single();

  if (profile?.phone && profile?.name) {
    redirect(searchParams.next ?? "/home");
  }

  const campusName =
    (profile?.campuses as { name?: string } | null)?.name ?? null;

  return (
    <ProfileSetupClient
      initialName={profile?.name ?? ""}
      email={profile?.email ?? user.email ?? ""}
      campusName={campusName}
      next={searchParams.next ?? "/home"}
    />
  );
}
