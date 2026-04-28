import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { Footer } from "@/components/Footer";
import { PriceDisplay } from "@/components/PriceDisplay";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateIST } from "@/lib/format";
import type { JobStatus } from "@/lib/types";
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

interface OrderRow {
  id: string;
  token: string | null;
  status: JobStatus;
  total_amount_paise: number;
  slot_time: string;
  bin_number: number | null;
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

  const { data: ordersData } = await sb
    .from("jobs")
    .select("id, token, status, total_amount_paise, slot_time, bin_number, shops(name)")
    .order("slot_time", { ascending: false })
    .limit(20);

  const orders = (ordersData ?? []) as unknown as OrderRow[];

  // Stats
  const totalSpent = orders
    .filter((o) => !["FAILED", "REFUNDED", "EXPIRED", "PENDING_PAYMENT"].includes(o.status))
    .reduce((s, o) => s + o.total_amount_paise, 0);
  const completed = orders.filter((o) => o.status === "COLLECTED").length;
  const upcoming = orders.filter((o) =>
    ["SCHEDULED", "BUNDLED", "PRINTED", "READY"].includes(o.status)
  ).length;

  const display = profile?.name ?? profile?.email ?? user.email ?? "User";
  const init = initials(profile?.name ?? profile?.email ?? user.email ?? "");

  return (
    <AppShell>
      <section className="container py-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 hairline bg-paper flex items-center justify-center font-mono font-bold text-xl">
            {init}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{display}</h1>
            <p className="text-sm text-ink/60 mt-1 font-mono truncate">{profile?.email ?? user.email}</p>
          </div>
        </div>
      </section>

      <section className="container py-4 grid grid-cols-3 gap-3">
        <Stat label="Upcoming" value={String(upcoming)} />
        <Stat label="Completed" value={String(completed)} />
        <Stat label="Total spent" value={<PriceDisplay paise={totalSpent} size="sm" />} />
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="smallcaps text-ink/70">Orders &amp; bills</h2>
          {orders.length > 0 && (
            <Link href="/jobs" className="smallcaps text-accent">
              See all →
            </Link>
          )}
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardBody className="text-center py-10 space-y-3">
              <p className="font-bold">No orders yet.</p>
              <p className="text-sm text-ink/60">Your bills and tokens will appear here.</p>
              <Button asChild variant="accent">
                <Link href="/jobs/new/shop">+ Print something</Link>
              </Button>
            </CardBody>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Card>
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {o.token && (
                            <span className="font-mono font-bold text-base">{o.token}</span>
                          )}
                          <StatusBadge status={o.status} />
                        </div>
                        <div className="font-bold truncate">{o.shops?.name ?? "Shop"}</div>
                        <div className="smallcaps text-ink/60 mt-1">
                          {formatDateIST(o.slot_time)}
                          {o.bin_number ? ` · Bin ${o.bin_number}` : ""}
                        </div>
                      </div>
                      <PriceDisplay paise={o.total_amount_paise} size="sm" className="shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-2 hairline-t pt-3">
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/jobs/${o.id}`}>Details</Link>
                      </Button>
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/jobs/${o.id}/bill`}>View bill</Link>
                      </Button>
                      <Button asChild size="sm">
                        <a
                          href={`/api/receipts/${o.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Download PDF
                        </a>
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Footer />
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="hairline p-3">
      <div className="smallcaps text-ink/60">{label}</div>
      <div className="font-mono font-bold text-xl num mt-1">{value}</div>
    </div>
  );
}
