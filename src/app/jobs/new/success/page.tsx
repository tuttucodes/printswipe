"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TokenDisplay } from "@/components/TokenDisplay";
import { CMYKBar } from "@/components/CMYKBar";
import { Wordmark } from "@/components/Wordmark";
import { formatSlotIST } from "@/lib/format";

interface JobInfo {
  id: string;
  slot_time: string;
  shops: { name: string; location_desc: string | null; lat: number | null; lng: number | null } | null;
}

function formatIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function buildIcs(opts: {
  uid: string;
  startUtc: Date;
  durationMin: number;
  summary: string;
  description: string;
  location: string;
}): string {
  const dtStart = formatIcsDate(opts.startUtc);
  const dtEnd = formatIcsDate(new Date(opts.startUtc.getTime() + opts.durationMin * 60_000));
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Printswipe//EN",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@printswipe.in`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escape(opts.summary)}`,
    `DESCRIPTION:${escape(opts.description)}`,
    `LOCATION:${escape(opts.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export default function NewJobSuccessPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const jobId = params.get("jobId") ?? "";
  const [job, setJob] = useState<JobInfo | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const run = async () => {
      const sb = createClient();
      const { data } = await sb
        .from("jobs")
        .select("id, slot_time, shops(name, location_desc, lat, lng)")
        .eq("id", jobId)
        .single();
      if (!cancelled && data) setJob(data as unknown as JobInfo);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    if (!token || !jobId) return;
    let cancelled = false;
    QRCode.toDataURL(JSON.stringify({ token, jobId }), {
      margin: 1,
      width: 280,
      color: { dark: "#0A0A0A", light: "#FAFAF7" },
    }).then((u) => {
      if (!cancelled) setQrUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [token, jobId]);

  const countdownLabel = useMemo(() => {
    if (!job) return "";
    const diffMin = Math.round((new Date(job.slot_time).getTime() - now.getTime()) / 60_000);
    if (diffMin <= 0) return "Now";
    if (diffMin < 60) return `${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h}h ${m}m`;
  }, [job, now]);

  const mapsUrl = job?.shops?.lat && job?.shops?.lng
    ? `https://www.google.com/maps/search/?api=1&query=${job.shops.lat},${job.shops.lng}`
    : job?.shops?.name
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.shops.name)}`
    : null;

  const onAddToCalendar = () => {
    if (!job) return;
    const ics = buildIcs({
      uid: job.id,
      startUtc: new Date(job.slot_time),
      durationMin: 15,
      summary: `Print pickup — ${token}`,
      description: `Show token ${token} at ${job.shops?.name ?? "the shop"}.`,
      location: `${job.shops?.name ?? ""}${job.shops?.location_desc ? ", " + job.shops.location_desc : ""}`,
    });
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `printswipe-${token}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onShare = async () => {
    const text = `Picking up print job ${token} at ${job?.shops?.name ?? "Printswipe"} — ${
      job ? formatSlotIST(job.slot_time) : ""
    }`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Printswipe", text });
      } catch {
        // user cancelled
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <main className="min-h-[100dvh] pb-12">
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-5 w-auto text-ink" />
        <Link href="/jobs" className="smallcaps text-ink/60 hover:text-ink">
          My Jobs
        </Link>
      </header>

      <section className="container py-8 text-center">
        <span className="smallcaps text-status-ready">Booked</span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">You're set.</h1>
        <p className="text-sm text-ink/60 mt-2 font-mono num">In {countdownLabel}</p>
      </section>

      <section className="container py-4 flex flex-col items-center gap-6">
        {token && <TokenDisplay token={token} size="hero" />}
        {qrUrl && (
          <div className="hairline p-4 bg-paper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR code" className="w-56 h-56" />
          </div>
        )}
      </section>

      {job && (
        <section className="container py-4 max-w-md mx-auto">
          <Card>
            <CardHeader>
              <span className="smallcaps text-ink/60">Pickup</span>
            </CardHeader>
            <CardBody>
              <div className="font-bold">{job.shops?.name ?? "Shop"}</div>
              {job.shops?.location_desc && (
                <p className="text-sm text-ink/60 mt-1">{job.shops.location_desc}</p>
              )}
              <p className="font-mono text-sm num mt-3">{formatSlotIST(job.slot_time)}</p>
            </CardBody>
            <CardFooter className="flex flex-wrap gap-2">
              {mapsUrl && (
                <Button asChild variant="secondary" size="sm">
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    Map
                  </a>
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={onAddToCalendar}>
                Add to Calendar
              </Button>
              <Button variant="secondary" size="sm" onClick={onShare}>
                Share
              </Button>
            </CardFooter>
          </Card>
        </section>
      )}

      <section className="container py-4 text-center">
        <Button asChild variant="primary">
          <Link href={jobId ? `/jobs/${jobId}` : "/jobs"}>View job details</Link>
        </Button>
      </section>
    </main>
  );
}
