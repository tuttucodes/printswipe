"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJobDraft } from "@/hooks/useJobDraft";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CMYKBar } from "@/components/CMYKBar";
import { Wordmark } from "@/components/Wordmark";
import { cn } from "@/lib/utils";
import { formatInTimeZone } from "date-fns-tz";

interface SlotInfoPayload {
  iso: string;
  label: string;
  capacity: number;
  used: number;
  isPast: boolean;
  isBlocked: boolean;
  isFull: boolean;
}

const IST = "Asia/Kolkata";

function dateForOffset(offsetDays: number): { date: Date; iso: string; label: string } {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const iso = formatInTimeZone(d, IST, "yyyy-MM-dd");
  const label =
    offsetDays === 0
      ? "Today"
      : offsetDays === 1
      ? "Tomorrow"
      : formatInTimeZone(d, IST, "EEE d MMM");
  return { date: d, iso, label };
}

export default function NewJobSlotPage() {
  const router = useRouter();
  const shopId = useJobDraft((s) => s.shopId);
  const shopName = useJobDraft((s) => s.shopName);
  const setSlot = useJobDraft((s) => s.setSlot);

  const [dayOffset, setDayOffset] = useState(0);
  const [slots, setSlots] = useState<SlotInfoPayload[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => [0, 1, 2].map(dateForOffset), []);

  useEffect(() => {
    if (!shopId) {
      router.push("/jobs/new/shop");
    }
  }, [shopId, router]);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    const run = async () => {
      setSlots(null);
      setError(null);
      const dateIso = days[dayOffset].iso;
      try {
        const r = await fetch(`/api/slots/availability?shopId=${shopId}&date=${dateIso}`);
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          if (!cancelled) setError(body.error ?? "Failed to load slots.");
          return;
        }
        const j = (await r.json()) as { slots: SlotInfoPayload[] };
        if (!cancelled) setSlots(j.slots);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load slots.");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [shopId, dayOffset, days]);

  const onPick = (slot: SlotInfoPayload) => {
    if (slot.isPast || slot.isFull || slot.isBlocked) return;
    setSlot(slot.iso);
    router.push("/jobs/new/files");
  };

  return (
    <main className="min-h-[100dvh] pb-12">
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-5 w-auto text-ink" />
        <Link href="/jobs/new/shop" className="smallcaps text-ink/60 hover:text-ink">
          ← Back
        </Link>
      </header>

      <section className="container py-4">
        <span className="smallcaps text-ink/60">Step 2 of 5</span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">Pick a slot.</h1>
        {shopName && <p className="smallcaps text-ink/60 mt-1">{shopName}</p>}
      </section>

      <nav className="container">
        <ul className="flex hairline-b">
          {days.map((d, i) => {
            const active = dayOffset === i;
            return (
              <li key={d.iso}>
                <button
                  onClick={() => setDayOffset(i)}
                  className={cn(
                    "block px-4 py-3 smallcaps transition-colors -mb-px",
                    active ? "text-ink border-b-2 border-accent" : "text-ink/60 hover:text-ink"
                  )}
                >
                  {d.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="container py-6">
        {error && (
          <Card>
            <CardBody>
              <p className="text-accent font-mono text-sm">{error}</p>
            </CardBody>
          </Card>
        )}
        {!slots && !error && (
          <Card>
            <CardBody className="text-center text-ink/60 py-8">Loading…</CardBody>
          </Card>
        )}
        {slots && slots.length === 0 && (
          <Card>
            <CardBody className="text-center text-ink/60 py-8">
              Closed on this day.
            </CardBody>
          </Card>
        )}
        {slots && slots.length > 0 && (
          <>
            <div className="flex items-center gap-4 mb-4 text-xs font-mono text-ink/60">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 inline-block bg-ink" /> Open
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 inline-block bg-ink/20" /> Full / Past
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 inline-block"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, #1A1A1A 0 1px, transparent 1px 4px)",
                  }}
                />{" "}
                Blocked
              </span>
            </div>
            <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {slots.map((s) => {
                const disabled = s.isPast || s.isFull || s.isBlocked;
                return (
                  <li key={s.iso}>
                    <button
                      disabled={disabled}
                      onClick={() => onPick(s)}
                      className={cn(
                        "w-full hairline p-3 text-left bg-paper transition-colors",
                        !disabled && "hover:bg-ink hover:text-paper",
                        s.isPast && "opacity-30 cursor-not-allowed",
                        s.isFull && !s.isPast && "opacity-40 cursor-not-allowed",
                        s.isBlocked && !s.isPast && "cursor-not-allowed"
                      )}
                      style={
                        s.isBlocked && !s.isPast
                          ? {
                              backgroundImage:
                                "repeating-linear-gradient(45deg, #1A1A1A 0 1px, transparent 1px 6px)",
                            }
                          : undefined
                      }
                    >
                      <div className="font-mono text-sm font-bold num">{s.label}</div>
                      <div className="font-mono text-[10px] text-ink/60 num mt-1">
                        {s.used}/{s.capacity}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
