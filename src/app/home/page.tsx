import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { RegistrationMark } from "@/components/RegistrationMark";
import { Footer } from "@/components/Footer";
import { formatInTimeZone } from "date-fns-tz";

interface ShopRow {
  id: string;
  name: string;
  location_desc: string | null;
  hours_json: Record<string, { open?: string; close?: string; closed?: boolean }>;
  slot_duration_min: number;
  campus_id: string;
}

const IST = "Asia/Kolkata";

function shopOpenStatus(
  hours: ShopRow["hours_json"],
  now: Date,
  tz: string
): { isOpen: boolean; nextSlotLabel: string | null } {
  const wname = formatInTimeZone(now, tz, "EEE").toLowerCase().slice(0, 3);
  const cfg = hours?.[wname];
  if (!cfg || cfg.closed) return { isOpen: false, nextSlotLabel: null };
  const nowHHmm = formatInTimeZone(now, tz, "HH:mm");
  const open = cfg.open ?? "09:00";
  const close = cfg.close ?? "18:00";
  const isOpen = nowHHmm >= open && nowHHmm < close;
  return { isOpen, nextSlotLabel: open };
}

function ceilToSlot(now: Date, durationMin: number): Date {
  const ms = durationMin * 60 * 1000;
  return new Date(Math.ceil(now.getTime() / ms) * ms);
}

export default async function HomePage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("profiles")
    .select("name, email, campus_id, campuses(name, timezone)")
    .eq("id", user.id)
    .single();

  const campus = (profile as unknown as { campuses?: { name?: string; timezone?: string } })?.campuses;
  const tz = campus?.timezone ?? IST;

  let shops: ShopRow[] = [];
  if (profile?.campus_id) {
    const { data } = await sb
      .from("shops")
      .select("id, name, location_desc, hours_json, slot_duration_min, campus_id")
      .eq("campus_id", profile.campus_id)
      .eq("is_active", true)
      .order("name");
    shops = (data ?? []) as ShopRow[];
  }

  const greeting = profile?.name ? `Hi, ${profile.name.split(" ")[0]}` : "Welcome";
  const now = new Date();

  return (
    <AppShell>
      <section className="container py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <RegistrationMark size={16} className="text-accent mb-2" />
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{greeting}.</h1>
            <p className="smallcaps text-ink/60 mt-2">
              {campus?.name ?? "Campus not set"}
            </p>
          </div>
          <Button asChild size="lg" variant="accent" className="hidden sm:inline-flex">
            <Link href="/jobs/new/shop">+ Print something</Link>
          </Button>
        </div>
      </section>

      <section className="container pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="smallcaps text-ink/70">Pick a print shop</h2>
          <span className="font-mono text-xs text-ink/60 num">
            {shops.length} {shops.length === 1 ? "shop" : "shops"}
          </span>
        </div>

        {shops.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center space-y-3">
              <p className="font-bold text-lg">No shops on your campus yet.</p>
              <p className="text-sm text-ink/60">
                We're working on adding more locations. In the meantime, contact us if you know a
                shop that should be listed.
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link href="/contact">Suggest a shop</Link>
              </Button>
            </CardBody>
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {shops.map((shop) => {
              const status = shopOpenStatus(shop.hours_json, now, tz);
              const nextSlot = ceilToSlot(now, shop.slot_duration_min);
              const minsToSlot = Math.max(0, Math.round((nextSlot.getTime() - now.getTime()) / 60000));
              return (
                <li key={shop.id}>
                  <Card className="h-full flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-xl font-bold tracking-tight">{shop.name}</h3>
                          {shop.location_desc && (
                            <p className="text-sm text-ink/60 mt-1">{shop.location_desc}</p>
                          )}
                        </div>
                        <span
                          className={
                            status.isOpen
                              ? "smallcaps text-status-ready border-[1.5px] border-status-ready/50 px-2 py-0.5 font-mono shrink-0"
                              : "smallcaps text-ink/60 border-[1.5px] border-ink/30 px-2 py-0.5 font-mono shrink-0"
                          }
                        >
                          {status.isOpen ? "Open" : "Closed"}
                        </span>
                      </div>
                    </CardHeader>
                    <CardBody className="flex-1 flex flex-col justify-between gap-4">
                      <div>
                        <span className="smallcaps text-ink/60">Next slot</span>
                        <p className="font-mono num text-base mt-1">
                          {status.isOpen ? `in ${minsToSlot} min` : `Opens at ${status.nextSlotLabel ?? "—"}`}
                        </p>
                      </div>
                      <Button asChild variant="primary" size="md" className="self-start">
                        <Link href={`/jobs/new/shop?shopId=${shop.id}`}>Print here →</Link>
                      </Button>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Mobile sticky CTA */}
      <div className="sm:hidden sticky bottom-0 z-20 bg-paper hairline-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button asChild variant="accent" size="lg" className="w-full">
          <Link href="/jobs/new/shop">+ Print something</Link>
        </Button>
      </div>

      <Footer />
    </AppShell>
  );
}
