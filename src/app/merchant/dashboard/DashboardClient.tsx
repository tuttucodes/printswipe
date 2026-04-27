"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { TokenDisplay } from "@/components/TokenDisplay";
import { PriceDisplay } from "@/components/PriceDisplay";
import { StatusBadge } from "@/components/StatusBadge";
import { StreamCard } from "@/components/StreamCard";
import { BinAssignmentTable } from "@/components/BinAssignmentTable";
import { CMYKBar } from "@/components/CMYKBar";
import { formatTimeIST, maskPhone, paiseToRupees } from "@/lib/format";
import {
  paperColorKey,
  type JobStatus,
  type StreamKey,
  type PaperType,
  type PaperSize,
  type ColorMode,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SLOT_GROUP_MIN = 30;
const FILTERS = [
  "ALL",
  "SCHEDULED",
  "BUNDLED",
  "PRINTED",
  "READY",
  "COLLECTED",
] as const;
type Filter = (typeof FILTERS)[number];

export interface DashboardJobFile {
  paperType: string;
  paperSize: string;
  colorMode: string;
  pageCount: number;
  copies: number;
}

export interface DashboardJob {
  id: string;
  token: string;
  slotTime: string;
  status: JobStatus;
  binNumber: number | null;
  totalAmountPaise: number;
  studentName: string;
  studentPhone: string | null;
  fileCount: number;
  files: DashboardJobFile[];
}

interface BundleResultStream {
  key: StreamKey;
  printerLabel: string;
  pageCount: number;
  sheetCount: number;
  isDuplex: boolean;
  signedUrl: string;
}

interface BundleResultPayload {
  batchId: string;
  streams: BundleResultStream[];
  binAssignments: Array<{
    jobId: string;
    token: string;
    studentName: string;
    binNumber: number;
    streamContributions: Record<string, { pageCount: number; sheetCount: number }>;
  }>;
}

export function DashboardClient({
  jobs,
  shopId,
  shopName,
  binCount,
}: {
  jobs: DashboardJob[];
  shopId: string;
  shopName: string;
  binCount: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const filter = (params.get("filter") ?? "ALL").toUpperCase() as Filter;
  const [bundling, setBundling] = useState(false);
  const [bundleErr, setBundleErr] = useState<string | null>(null);
  const [bundleResult, setBundleResult] = useState<BundleResultPayload | null>(null);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [batchJobIds, setBatchJobIds] = useState<string[]>([]);
  const [marking, setMarking] = useState(false);

  const stats = useMemo(() => {
    const now = Date.now();
    const oneHour = now + 60 * 60 * 1000;
    let revenue = 0;
    let nextHour = 0;
    let queue = 0;
    for (const j of jobs) {
      revenue += j.totalAmountPaise;
      const t = new Date(j.slotTime).getTime();
      if (t >= now && t <= oneHour) nextHour++;
      if (j.status === "SCHEDULED") queue++;
    }
    return { revenue, nextHour, queue, total: jobs.length };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    if (filter === "ALL") return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [filter, jobs]);

  const groupedJobs = useMemo(() => groupBySlotWindow(filteredJobs), [filteredJobs]);

  function setFilter(f: Filter) {
    const sp = new URLSearchParams(params.toString());
    if (f === "ALL") sp.delete("filter");
    else sp.set("filter", f);
    router.replace(`/merchant/dashboard${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  async function bundleJobs(jobIds: string[]) {
    if (jobIds.length === 0) return;
    setBundling(true);
    setBundleErr(null);
    setBundleResult(null);
    setSentMap({});
    try {
      const res = await fetch("/api/merchant/bundle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shopId, jobIds }),
      });
      const json = (await res.json()) as
        | { success: true; data: BundleResultPayload }
        | { success: false; error: string };
      if (!res.ok || !("success" in json) || !json.success) {
        const msg = !json.success ? json.error : "Bundle failed";
        setBundleErr(msg);
        return;
      }
      setBundleResult(json.data);
      setBatchJobIds(jobIds);
      router.refresh();
    } catch (e) {
      setBundleErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setBundling(false);
    }
  }

  function bundleNext(n: number) {
    const ids = jobs
      .filter((j) => j.status === "SCHEDULED")
      .slice(0, n)
      .map((j) => j.id);
    void bundleJobs(ids);
  }

  function bundleDueSoon() {
    const cutoff = Date.now() + 30 * 60 * 1000;
    const ids = jobs
      .filter((j) => j.status === "SCHEDULED" && new Date(j.slotTime).getTime() <= cutoff)
      .map((j) => j.id);
    void bundleJobs(ids);
  }

  async function markBatchPrinted() {
    if (batchJobIds.length === 0) return;
    setMarking(true);
    try {
      await fetch("/api/merchant/jobs/batch-status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobIds: batchJobIds, status: "PRINTED" }),
      });
      setBundleResult(null);
      setBatchJobIds([]);
      setSentMap({});
      router.refresh();
    } finally {
      setMarking(false);
    }
  }

  const allSent =
    bundleResult !== null &&
    bundleResult.streams.length > 0 &&
    bundleResult.streams.every((s) => sentMap[s.key]);

  const scheduledCount = jobs.filter((j) => j.status === "SCHEDULED").length;

  return (
    <div className="min-h-[100dvh]">
      <CMYKBar height={4} />
      <header className="container py-6 hairline-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="smallcaps text-ink/60">{shopName}</div>
            <h1 className="text-3xl font-bold">Today's queue</h1>
          </div>
          <div className="text-sm text-ink/60 font-mono">
            {binCount} bins · {scheduledCount} scheduled
          </div>
        </div>
      </header>

      <section className="container py-6">
        <StatsBar stats={stats} />
      </section>

      <section className="container">
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "smallcaps hairline px-3 py-1.5 transition-colors",
                filter === f ? "bg-ink text-paper" : "bg-paper hover:bg-ink/5"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Button onClick={() => bundleNext(5)} disabled={bundling || scheduledCount === 0}>
            Bundle next 5
          </Button>
          <Button
            variant="secondary"
            onClick={() => bundleNext(10)}
            disabled={bundling || scheduledCount === 0}
          >
            Bundle next 10
          </Button>
          <Button variant="secondary" onClick={bundleDueSoon} disabled={bundling}>
            Bundle all due in 30 min
          </Button>
          {bundling && <span className="text-sm text-ink/60 self-center">Bundling…</span>}
        </div>

        {bundleErr && (
          <div className="hairline border-status-failed text-status-failed p-3 mb-4 text-sm">
            {bundleErr}
          </div>
        )}

        {bundleResult && (
          <BundleResultPanel
            result={bundleResult}
            sentMap={sentMap}
            setSent={(k, v) => setSentMap((m) => ({ ...m, [k]: v }))}
            allSent={allSent}
            marking={marking}
            onMarkPrinted={markBatchPrinted}
          />
        )}
      </section>

      <section className="container pb-20">
        {groupedJobs.length === 0 ? (
          <div className="hairline p-8 text-center">
            <div className="smallcaps text-ink/60 mb-2">Empty</div>
            <p className="text-ink/70">No jobs match this filter today.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedJobs.map((g) => (
              <SlotWindow key={g.key} label={g.label} jobs={g.jobs} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatsBar({ stats }: { stats: { total: number; revenue: number; nextHour: number; queue: number } }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Jobs today" value={String(stats.total)} mono />
      <Stat label="Revenue today" valueNode={<PriceDisplay paise={stats.revenue} size="md" />} />
      <Stat label="In next hour" value={String(stats.nextHour)} mono />
      <Stat label="Queue" value={String(stats.queue)} mono />
    </div>
  );
}

function Stat({
  label,
  value,
  valueNode,
  mono,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="hairline bg-paper p-4">
      <div className="smallcaps text-ink/60">{label}</div>
      <div className={cn("mt-2", mono && "font-mono num text-3xl font-bold")}>
        {valueNode ?? value}
      </div>
    </div>
  );
}

function groupBySlotWindow(jobs: DashboardJob[]) {
  const groups = new Map<string, DashboardJob[]>();
  for (const j of jobs) {
    const d = new Date(j.slotTime);
    const min = d.getMinutes();
    const slotMin = Math.floor(min / SLOT_GROUP_MIN) * SLOT_GROUP_MIN;
    const start = new Date(d);
    start.setMinutes(slotMin, 0, 0);
    const key = start.toISOString();
    const arr = groups.get(key);
    if (arr) arr.push(j);
    else groups.set(key, [j]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, jobs]) => ({
      key,
      label: formatTimeIST(key),
      jobs,
    }));
}

function SlotWindow({ label, jobs }: { label: string; jobs: DashboardJob[] }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 hairline-b pb-2">
        <div className="font-mono font-bold text-lg">{label}</div>
        <div className="smallcaps text-ink/60">{jobs.length} job{jobs.length === 1 ? "" : "s"}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: DashboardJob }) {
  const summary = useMemo(() => streamSummary(job.files), [job.files]);
  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <TokenDisplay token={job.token || "—"} size="sm" />
        <div className="text-right">
          <StatusBadge status={job.status} />
          {job.binNumber !== null && (
            <div className="mt-2 inline-block bg-accent text-paper text-xs font-mono font-bold num px-2 py-0.5">
              BIN {job.binNumber}
            </div>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-2">
        <div>
          <div className="smallcaps text-ink/60">Student</div>
          <div className="font-medium">{job.studentName}</div>
          <div className="text-xs text-ink/60 font-mono">{maskPhone(job.studentPhone)}</div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="smallcaps text-ink/60 mr-1">Slot</span>
            <span className="font-mono">{formatTimeIST(job.slotTime)}</span>
          </div>
          <div>
            <span className="smallcaps text-ink/60 mr-1">Files</span>
            <span className="font-mono num">{job.fileCount}</span>
          </div>
        </div>
        {summary.length > 0 && (
          <div className="text-xs space-y-0.5 hairline-t pt-2">
            {summary.map((s) => (
              <div key={s.label} className="flex justify-between font-mono">
                <span className="text-ink/70">{s.label}</span>
                <span className="num">{s.pages}p</span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
      <CardFooter className="flex justify-between items-center text-sm">
        <span className="smallcaps text-ink/60">Total</span>
        <span className="font-mono num font-bold">{paiseToRupees(job.totalAmountPaise)}</span>
      </CardFooter>
    </Card>
  );
}

function streamSummary(files: DashboardJobFile[]): { label: string; pages: number }[] {
  const map = new Map<string, number>();
  for (const f of files) {
    const color: "color" | "bw" =
      f.colorMode === "ALL_BW" ? "bw" : f.colorMode === "ALL_COLOR" ? "color" : "color";
    try {
      const k = paperColorKey(f.paperType as PaperType, f.paperSize as PaperSize, color);
      const bucket = String(k);
      map.set(bucket, (map.get(bucket) ?? 0) + f.pageCount * f.copies);
    } catch {
      // skip unsupported combos silently
    }
    void (f.colorMode as ColorMode);
  }
  return [...map.entries()].map(([label, pages]) => ({ label, pages }));
}

function BundleResultPanel({
  result,
  sentMap,
  setSent,
  allSent,
  marking,
  onMarkPrinted,
}: {
  result: BundleResultPayload;
  sentMap: Record<string, boolean>;
  setSent: (key: string, v: boolean) => void;
  allSent: boolean;
  marking: boolean;
  onMarkPrinted: () => void;
}) {
  return (
    <div className="hairline bg-paper p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="smallcaps text-ink/60">Batch ready</div>
          <div className="font-mono text-xs text-ink/60">{result.batchId}</div>
        </div>
        <Button variant="accent" disabled={!allSent || marking} onClick={onMarkPrinted}>
          {marking ? "Marking…" : "Mark batch printed"}
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {result.streams.map((s, idx) => (
          <StreamCard
            key={s.key}
            index={idx + 1}
            total={result.streams.length}
            streamKey={s.key}
            printerLabel={s.printerLabel}
            pageCount={s.pageCount}
            sheetCount={s.sheetCount}
            isDuplex={s.isDuplex}
            signedUrl={s.signedUrl}
            sent={sentMap[s.key] ?? false}
            onMarkSent={() => setSent(s.key, !sentMap[s.key])}
          />
        ))}
      </div>
      <div>
        <div className="smallcaps text-ink/60 mb-2">Bin assignments</div>
        <BinAssignmentTable rows={result.binAssignments} />
      </div>
    </div>
  );
}
