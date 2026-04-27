"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { TokenDisplay } from "@/components/TokenDisplay";
import { PriceDisplay } from "@/components/PriceDisplay";
import { StatusBadge } from "@/components/StatusBadge";
import { CMYKBar } from "@/components/CMYKBar";
import { MerchantShell } from "@/components/MerchantShell";
import { formatTimeIST, maskPhone } from "@/lib/format";
import {
  paperColorKey,
  type JobStatus,
  type PaperType,
  type PaperSize,
} from "@/lib/types";

interface LookupFile {
  filename: string;
  page_count: number;
  paper_type: string;
  paper_size: string;
  color_mode: string;
  copies: number;
}

interface LookupJob {
  id: string;
  token: string;
  slot_time: string;
  status: JobStatus;
  bin_number: number | null;
  total_amount_paise: number;
  collected_at: string | null;
  profiles: { name: string | null; phone: string | null } | null;
  job_files: LookupFile[];
}

export default function MerchantLookupPage() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [job, setJob] = useState<LookupJob | null>(null);
  const [marking, setMarking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => undefined);
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  async function lookup(t: string) {
    setBusy(true);
    setErr(null);
    setJob(null);
    try {
      const res = await fetch(`/api/merchant/lookup?token=${encodeURIComponent(t)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErr(json.error ?? "Not found");
      } else {
        setJob(json.data as LookupJob);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    await lookup(token.trim().toUpperCase());
  }

  async function startScan() {
    setErr(null);
    setScanning(true);
    try {
      const mod = await import("html5-qrcode");
      const Html5Qrcode = mod.Html5Qrcode;
      const scanner = new Html5Qrcode("qr-scanner");
      scannerRef.current = {
        stop: () => scanner.stop(),
        clear: () => scanner.clear(),
      };
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded: string) => {
          try {
            const parsed = JSON.parse(decoded);
            const t = (parsed.token ?? decoded).toString().toUpperCase();
            setToken(t);
            await scanner.stop();
            scanner.clear();
            scannerRef.current = null;
            setScanning(false);
            void lookup(t);
          } catch {
            const t = decoded.toUpperCase();
            setToken(t);
            await scanner.stop();
            scanner.clear();
            scannerRef.current = null;
            setScanning(false);
            void lookup(t);
          }
        },
        () => undefined
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Scanner failed to start");
      setScanning(false);
    }
  }

  async function stopScan() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function markCollected() {
    if (!job) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/merchant/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "COLLECTED" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErr(json.error ?? "Update failed");
      } else {
        setJob({ ...job, status: "COLLECTED", collected_at: new Date().toISOString() });
      }
    } finally {
      setMarking(false);
    }
  }

  return (
    <MerchantShell>
      <CMYKBar height={4} />
      <div className="container py-8 max-w-3xl">
        <div className="mb-6">
          <div className="smallcaps text-ink/60">Token lookup</div>
          <h1 className="text-3xl font-bold mt-1">Find a job</h1>
        </div>

        <Card className="mb-6">
          <CardBody>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token">Enter token number</Label>
                <Input
                  id="token"
                  ref={inputRef}
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  placeholder="A001"
                  autoFocus
                  className="text-3xl h-16 text-center tracking-[0.4em]"
                  maxLength={8}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy || !token.trim()} className="flex-1">
                  {busy ? "Looking up…" : "Look up"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={scanning ? stopScan : startScan}
                >
                  {scanning ? "Stop scan" : "Scan QR"}
                </Button>
              </div>
            </form>
            {scanning && (
              <div className="mt-4">
                <div id="qr-scanner" ref={scannerDivRef} className="hairline" />
              </div>
            )}
          </CardBody>
        </Card>

        {err && (
          <div className="hairline border-status-failed text-status-failed p-3 mb-4 text-sm">
            {err}
          </div>
        )}

        {job && <JobDetailCard job={job} marking={marking} onMarkCollected={markCollected} />}
      </div>
    </MerchantShell>
  );
}

function JobDetailCard({
  job,
  marking,
  onMarkCollected,
}: {
  job: LookupJob;
  marking: boolean;
  onMarkCollected: () => void;
}) {
  const summary = useMemo(() => streamSummary(job.job_files), [job.job_files]);
  const collected = job.status === "COLLECTED";
  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-4">
        <TokenDisplay token={job.token} size="md" />
        <div className="text-right">
          <StatusBadge status={job.status} />
          {job.bin_number !== null && (
            <div className="mt-3 inline-block bg-accent text-paper text-xl font-mono font-bold num px-4 py-2">
              BIN {job.bin_number}
            </div>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="smallcaps text-ink/60">Student</div>
            <div className="font-medium text-lg">{job.profiles?.name ?? "—"}</div>
            <div className="text-sm text-ink/60 font-mono">
              {maskPhone(job.profiles?.phone)}
            </div>
          </div>
          <div>
            <div className="smallcaps text-ink/60">Slot</div>
            <div className="font-mono text-lg">{formatTimeIST(job.slot_time)}</div>
          </div>
        </div>

        {summary.length > 0 && (
          <div>
            <div className="smallcaps text-ink/60 mb-2">Streams</div>
            <div className="hairline">
              <table className="w-full text-sm">
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.label} className="hairline-b last:border-b-0">
                      <td className="px-3 py-2 font-mono">{s.label}</td>
                      <td className="px-3 py-2 text-right font-mono num">{s.pages} pages</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardBody>
      <CardFooter className="flex items-center justify-between">
        <div>
          <div className="smallcaps text-ink/60">Total paid</div>
          <PriceDisplay paise={job.total_amount_paise} size="md" />
        </div>
        <Button
          variant={collected ? "ghost" : "accent"}
          disabled={collected || marking}
          onClick={onMarkCollected}
        >
          {collected ? "Collected" : marking ? "Marking…" : "Mark as collected"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function streamSummary(files: LookupFile[]): { label: string; pages: number }[] {
  const map = new Map<string, number>();
  for (const f of files) {
    const color: "color" | "bw" =
      f.color_mode === "ALL_BW" ? "bw" : "color";
    try {
      const k = paperColorKey(
        f.paper_type as PaperType,
        f.paper_size as PaperSize,
        color
      );
      map.set(k, (map.get(k) ?? 0) + f.page_count * f.copies);
    } catch {
      // skip
    }
  }
  return [...map.entries()].map(([label, pages]) => ({ label, pages }));
}
