import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CMYKBar } from "@/components/CMYKBar";
import { Wordmark } from "@/components/Wordmark";
import { BottomNav } from "@/components/BottomNav";
import { PriceDisplay } from "@/components/PriceDisplay";
import { formatDateIST } from "@/lib/format";
import { ProfileClient } from "./ProfileClient";

interface ProfileRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  campus_id: string | null;
  notification_sms: boolean;
  notification_email: boolean;
  campuses: { name: string } | null;
}

interface RecentJob {
  id: string;
  total_amount_paise: number;
  slot_time: string;
  shops: { name: string } | null;
}

function initials(nameOrEmail: string): string {
  const src = nameOrEmail.trim();
  if (!src) return "??";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default async function ProfilePage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await sb
    .from("profiles")
    .select("id, email, name, phone, campus_id, notification_sms, notification_email, campuses(name)")
    .eq("id", user.id)
    .single();

  const profile = profileData as unknown as ProfileRow | null;

  const { data: jobsData } = await sb
    .from("jobs")
    .select("id, total_amount_paise, slot_time, shops(name)")
    .order("slot_time", { ascending: false })
    .limit(10);

  const recentJobs = (jobsData ?? []) as unknown as RecentJob[];

  const display = profile?.name ?? profile?.email ?? user.email ?? "User";
  const init = initials(profile?.name ?? profile?.email ?? user.email ?? "");

  return (
    <main className="min-h-[100dvh] pb-24 md:pb-8">
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-5 w-auto text-ink" />
        <Link href="/home" className="smallcaps text-ink/60 hover:text-ink">
          ← Home
        </Link>
      </header>

      <section className="container py-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 hairline bg-paper flex items-center justify-center font-mono font-bold text-xl">
            {init}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{display}</h1>
            <p className="text-sm text-ink/60 mt-1 font-mono">{profile?.email ?? user.email}</p>
          </div>
        </div>
      </section>

      <section className="container py-4">
        <ProfileClient
          initialName={profile?.name ?? ""}
          initialPhone={profile?.phone ?? ""}
          initialNotifSms={profile?.notification_sms ?? true}
          initialNotifEmail={profile?.notification_email ?? true}
          campusName={profile?.campuses?.name ?? null}
        />
      </section>

      <section className="container py-6">
        <h2 className="smallcaps text-ink/70 mb-3">Recent Receipts</h2>
        {recentJobs.length === 0 ? (
          <Card>
            <CardBody className="text-center py-8 text-ink/60">No receipts yet.</CardBody>
          </Card>
        ) : (
          <ul className="grid gap-2">
            {recentJobs.map((j) => (
              <li key={j.id}>
                <a
                  href={`/api/receipts/${j.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="hover:bg-ink/[0.02] transition-colors">
                    <CardBody className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{j.shops?.name ?? "Shop"}</div>
                        <div className="smallcaps text-ink/60 mt-1">
                          {formatDateIST(j.slot_time)}
                        </div>
                      </div>
                      <PriceDisplay paise={j.total_amount_paise} size="sm" />
                    </CardBody>
                  </Card>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BottomNav />
    </main>
  );
}
