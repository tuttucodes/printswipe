import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TokenDisplay } from "@/components/TokenDisplay";
import { StatusBadge } from "@/components/StatusBadge";
import { PriceDisplay } from "@/components/PriceDisplay";
import { CMYKBar } from "@/components/CMYKBar";
import { Wordmark } from "@/components/Wordmark";
import { BottomNav } from "@/components/BottomNav";
import { formatSlotIST } from "@/lib/format";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface JobDetailRow {
  id: string;
  token: string | null;
  slot_time: string;
  status: JobStatus;
  bin_number: number | null;
  total_amount_paise: number;
  premium_amount_paise: number;
  gst_amount_paise: number;
  notes: string | null;
  shops: { name: string; location_desc: string | null; lat: number | null; lng: number | null } | null;
  job_files: Array<{
    id: string;
    filename: string;
    page_count: number;
    paper_type: string;
    paper_size: string;
    color_mode: string;
    sides: string;
    layout: number;
    copies: number;
    page_range_spec: string | null;
    color_pages_spec: string | null;
  }>;
}

const TIMELINE_ORDER: JobStatus[] = [
  "PENDING_PAYMENT",
  "SCHEDULED",
  "BUNDLED",
  "PRINTED",
  "READY",
  "COLLECTED",
];

interface PageProps {
  params: { id: string };
}

export default async function JobDetailPage({ params }: PageProps) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await sb
    .from("jobs")
    .select(
      "id, token, slot_time, status, bin_number, total_amount_paise, premium_amount_paise, gst_amount_paise, notes, shops(name, location_desc, lat, lng), job_files(id, filename, page_count, paper_type, paper_size, color_mode, sides, layout, copies, page_range_spec, color_pages_spec)"
    )
    .eq("id", params.id)
    .single();

  if (!data) notFound();
  const job = data as unknown as JobDetailRow;

  const qrPayload = JSON.stringify({ token: job.token, jobId: job.id });
  const qrDataUrl = job.token
    ? await QRCode.toDataURL(qrPayload, { margin: 1, width: 280, color: { dark: "#0A0A0A", light: "#FAFAF7" } })
    : null;

  const currentIdx = TIMELINE_ORDER.indexOf(job.status);
  const isTerminal = ["EXPIRED", "FAILED", "REFUNDED"].includes(job.status);

  return (
    <main className="min-h-[100dvh] pb-24 md:pb-8">
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-5 w-auto text-ink" />
        <Link href="/jobs" className="smallcaps text-ink/60 hover:text-ink">
          ← Jobs
        </Link>
      </header>

      <section className="container py-6 grid gap-6 md:grid-cols-2 items-start">
        {job.token ? (
          <div className="flex flex-col items-center gap-4">
            <TokenDisplay token={job.token} size="hero" />
            <div className="text-center">
              <span className="smallcaps text-ink/60">Slot</span>
              <p className="font-mono num text-base mt-1">{formatSlotIST(job.slot_time)}</p>
            </div>
            {job.bin_number && (
              <div className="text-center">
                <span className="smallcaps text-ink/60">Bin</span>
                <p className="font-mono num font-bold text-2xl mt-1">#{job.bin_number}</p>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardBody className="text-center py-12 text-ink/60">No token assigned yet.</CardBody>
          </Card>
        )}

        {qrDataUrl && (
          <Card>
            <CardHeader>
              <span className="smallcaps text-ink/60">Show at counter</span>
            </CardHeader>
            <CardBody className="flex items-center justify-center p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR code" className="w-64 h-64" />
            </CardBody>
            <CardFooter>
              <StatusBadge status={job.status} />
            </CardFooter>
          </Card>
        )}
      </section>

      <section className="container py-6">
        <h2 className="smallcaps text-ink/70 mb-3">Status</h2>
        <Card>
          <CardBody>
            {isTerminal ? (
              <div>
                <StatusBadge status={job.status} />
              </div>
            ) : (
              <ol className="space-y-3">
                {TIMELINE_ORDER.slice(1).map((s, idx) => {
                  const stepIdx = idx + 1;
                  const done = currentIdx >= stepIdx;
                  const current = currentIdx === stepIdx;
                  return (
                    <li key={s} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "w-2 h-2 inline-block",
                          done ? "bg-accent" : "bg-ink/20"
                        )}
                      />
                      <span
                        className={cn(
                          "smallcaps",
                          current ? "text-accent font-bold" : done ? "text-ink" : "text-ink/40"
                        )}
                      >
                        {s.replace("_", " ")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="container py-6">
        <h2 className="smallcaps text-ink/70 mb-3">Files</h2>
        <ul className="grid gap-3">
          {job.job_files?.map((f) => (
            <li key={f.id}>
              <Card>
                <CardBody>
                  <div className="font-mono text-sm font-bold truncate mb-2">{f.filename}</div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono text-ink/70 num">
                    <dt className="text-ink/60">Pages</dt>
                    <dd>{f.page_count}</dd>
                    <dt className="text-ink/60">Paper</dt>
                    <dd>{f.paper_type === "POSTER_GLOSSY" ? "Poster" : "Plain"} {f.paper_size}</dd>
                    <dt className="text-ink/60">Color</dt>
                    <dd>{f.color_mode.replace("_", " ")}</dd>
                    <dt className="text-ink/60">Sides</dt>
                    <dd>{f.sides}</dd>
                    <dt className="text-ink/60">Layout</dt>
                    <dd>{f.layout}-up</dd>
                    <dt className="text-ink/60">Copies</dt>
                    <dd>{f.copies}</dd>
                    {f.page_range_spec && (
                      <>
                        <dt className="text-ink/60">Range</dt>
                        <dd>{f.page_range_spec}</dd>
                      </>
                    )}
                    {f.color_pages_spec && (
                      <>
                        <dt className="text-ink/60">Color pgs</dt>
                        <dd>{f.color_pages_spec}</dd>
                      </>
                    )}
                  </dl>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="container py-6">
        <h2 className="smallcaps text-ink/70 mb-3">Shop & Total</h2>
        <Card>
          <CardBody className="grid gap-4">
            <div>
              <div className="font-bold">{job.shops?.name ?? "Shop"}</div>
              {job.shops?.location_desc && (
                <p className="text-sm text-ink/60 mt-1">{job.shops.location_desc}</p>
              )}
            </div>
            <div className="hairline-t pt-4 flex items-center justify-between">
              <span className="smallcaps text-ink/60">Total Paid</span>
              <PriceDisplay paise={job.total_amount_paise} size="md" />
            </div>
          </CardBody>
          <CardFooter>
            <p className="text-xs text-ink/60">
              Need help? Contact your shop directly or email support@printswipe.in.
            </p>
          </CardFooter>
        </Card>
      </section>

      <BottomNav />
    </main>
  );
}
