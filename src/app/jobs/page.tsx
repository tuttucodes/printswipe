import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { TokenDisplay } from "@/components/TokenDisplay";
import { StatusBadge } from "@/components/StatusBadge";
import { PriceDisplay } from "@/components/PriceDisplay";
import { Footer } from "@/components/Footer";
import { formatSlotIST, formatDateIST } from "@/lib/format";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface JobRow {
  id: string;
  token: string | null;
  slot_time: string;
  status: JobStatus;
  total_amount_paise: number;
  created_at: string;
  shops: { name: string } | null;
  job_files: { filename: string }[];
}

const UPCOMING_STATUSES: JobStatus[] = ["SCHEDULED", "BUNDLED", "PRINTED", "READY"];
const PAST_STATUSES: JobStatus[] = ["COLLECTED", "EXPIRED", "FAILED", "REFUNDED"];

interface PageProps {
  searchParams: { tab?: string };
}

function countdown(slotIso: string, now: Date): string {
  const diff = new Date(slotIso).getTime() - now.getTime();
  if (diff <= 0) return "now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24) return `in ${hrs}h ${rem}m`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d`;
}

export default async function JobsPage({ searchParams }: PageProps) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const tab = searchParams.tab === "past" ? "past" : "upcoming";

  const filterStatuses = tab === "past" ? PAST_STATUSES : UPCOMING_STATUSES;

  const { data } = await sb
    .from("jobs")
    .select("id, token, slot_time, status, total_amount_paise, created_at, shops(name), job_files(filename)")
    .in("status", filterStatuses)
    .order("slot_time", { ascending: tab === "upcoming" })
    .limit(50);

  const jobs = (data ?? []) as unknown as JobRow[];
  const now = new Date();

  return (
    <AppShell>
      <section className="container py-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My jobs.</h1>
        <Button asChild variant="accent" size="md" className="hidden sm:inline-flex">
          <Link href="/jobs/new/shop">+ Print something</Link>
        </Button>
      </section>

      <nav className="container mt-2">
        <ul className="flex hairline-b">
          {[
            { id: "upcoming", label: "Upcoming" },
            { id: "past", label: "Past" },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <li key={t.id}>
                <Link
                  href={`/jobs?tab=${t.id}`}
                  className={cn(
                    "block px-5 py-3 smallcaps transition-colors -mb-px",
                    active
                      ? "text-ink border-b-2 border-accent"
                      : "text-ink/60 hover:text-ink"
                  )}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="container py-6">
        {jobs.length === 0 ? (
          <Card>
            <CardBody className="py-16 text-center">
              <p className="text-ink/60">
                {tab === "upcoming" ? "No upcoming jobs." : "No past jobs yet."}
              </p>
              {tab === "upcoming" && (
                <Button asChild variant="accent" className="mt-4">
                  <Link href="/jobs/new/shop">+ Print something</Link>
                </Button>
              )}
            </CardBody>
          </Card>
        ) : (
          <ul className="grid gap-4">
            {jobs.map((job) => (
              <li key={job.id}>
                {tab === "upcoming" ? (
                  <Link href={`/jobs/${job.id}`} className="block">
                    <Card className="hover:bg-ink/[0.02] transition-colors">
                      <CardBody className="flex items-center gap-5">
                        {job.token && <TokenDisplay token={job.token} size="sm" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{job.shops?.name ?? "Shop"}</div>
                          <div className="text-sm text-ink/60 mt-1">
                            {formatSlotIST(job.slot_time)}
                          </div>
                          <div className="font-mono text-xs text-ink/60 num mt-1">
                            {countdown(job.slot_time, now)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge status={job.status} />
                          <span className="smallcaps text-ink/40">View QR</span>
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                ) : (
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold truncate">{job.shops?.name ?? "Shop"}</div>
                          <div className="smallcaps text-ink/60 mt-1">
                            {formatDateIST(job.slot_time)}
                          </div>
                        </div>
                        <StatusBadge status={job.status} />
                      </div>
                    </CardHeader>
                    <CardBody>
                      {job.job_files?.length > 0 && (
                        <ul className="space-y-1 mb-4">
                          {job.job_files.map((f, i) => (
                            <li key={i} className="font-mono text-xs text-ink/70 truncate">
                              {f.filename}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <PriceDisplay paise={job.total_amount_paise} size="sm" />
                        <div className="flex gap-2">
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/jobs/${job.id}/bill`}>View bill</Link>
                          </Button>
                          <Button asChild size="sm">
                            <a href={`/api/receipts/${job.id}`} target="_blank" rel="noopener noreferrer">
                              Download
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sm:hidden sticky bottom-0 z-20 bg-paper hairline-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button asChild variant="accent" size="lg" className="w-full">
          <Link href="/jobs/new/shop">+ Print something</Link>
        </Button>
      </div>
      <Footer />
    </AppShell>
  );
}
