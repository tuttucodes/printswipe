"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { CMYKBar } from "@/components/CMYKBar";
import { STREAM_KEYS, humanStreamLabel, type PrinterConfig, type PricingConfig, type StreamKey, type Printer, type PaperType, type PaperSize } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];

type HoursDay = { open: string; close: string } | { closed: true };
type HoursMap = Record<string, HoursDay>;

interface InitialState {
  hours: Record<string, unknown>;
  slotDurationMin: number;
  maxPerSlot: number;
  binCount: number;
  pricing: PricingConfig;
  printerConfig: PrinterConfig;
  premiumPercent: number;
  gstEnabled: boolean;
  gstNumber: string;
}

const SLOT_DURATIONS = [15, 20, 30] as const;
const PAPER_TYPES: PaperType[] = ["PLAIN", "POSTER_GLOSSY"];
const PAPER_SIZES: PaperSize[] = ["A4", "A3", "A2"];

export function SettingsClient({
  shopId,
  shopName,
  initial,
}: {
  shopId: string;
  shopName: string;
  initial: InitialState;
}) {
  const [hours, setHours] = useState<HoursMap>(normalizeHours(initial.hours));
  const [slotDurationMin, setSlotDurationMin] = useState(initial.slotDurationMin);
  const [maxPerSlot, setMaxPerSlot] = useState(initial.maxPerSlot);
  const [binCount, setBinCount] = useState(initial.binCount);
  const [premiumPercent, setPremiumPercent] = useState(initial.premiumPercent);
  const [gstEnabled, setGstEnabled] = useState(initial.gstEnabled);
  const [gstNumber, setGstNumber] = useState(initial.gstNumber);

  const [pricing, setPricing] = useState<PricingConfig>(initial.pricing);
  const [printers, setPrinters] = useState<Printer[]>(initial.printerConfig.printers);
  const [routing, setRouting] = useState<Record<StreamKey, string>>(
    initial.printerConfig.stream_routing
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setHour(d: Day, next: HoursDay) {
    setHours((h) => ({ ...h, [d]: next }));
  }

  function setPriceField(
    section: "plain" | "poster_glossy",
    color: "bw" | "color",
    size: "A4" | "A3" | "A2",
    rupees: number
  ) {
    const paise = Math.round(rupees * 100);
    setPricing((p) => {
      if (section === "plain" && (size === "A4" || size === "A3")) {
        return {
          ...p,
          plain: {
            ...p.plain,
            [color]: { ...p.plain[color], [size]: paise },
          },
        };
      }
      if (section === "poster_glossy" && (size === "A4" || size === "A2")) {
        return {
          ...p,
          poster_glossy: {
            ...p.poster_glossy,
            [color]: { ...p.poster_glossy[color], [size]: paise },
          },
        };
      }
      return p;
    });
  }

  function updatePrinter(idx: number, patch: Partial<Printer>) {
    setPrinters((arr) => arr.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function removePrinter(idx: number) {
    setPrinters((arr) => arr.filter((_, i) => i !== idx));
  }
  function addPrinter() {
    setPrinters((arr) => [
      ...arr,
      {
        id: `printer-${Date.now()}`,
        label: "New Printer",
        supports_color: true,
        supported_paper_types: ["PLAIN"],
        supported_paper_sizes: ["A4"],
        supports_duplex: false,
      },
    ]);
  }

  function validateRouting(): string | null {
    for (const k of STREAM_KEYS) {
      const printerId = routing[k];
      if (!printerId) return `${humanStreamLabel(k)} needs a printer`;
      const p = printers.find((pr) => pr.id === printerId);
      if (!p) return `${humanStreamLabel(k)} routes to unknown printer`;
      const isPoster = k.startsWith("poster_");
      const requiredPaper: PaperType = isPoster ? "POSTER_GLOSSY" : "PLAIN";
      if (!p.supported_paper_types.includes(requiredPaper)) {
        return `${p.label} cannot handle ${requiredPaper}`;
      }
      const size = (k.endsWith("_a4") ? "A4" : k.endsWith("_a3") ? "A3" : "A2") as PaperSize;
      if (!p.supported_paper_sizes.includes(size)) {
        return `${p.label} cannot handle ${size}`;
      }
      if (k.startsWith("color_") && !p.supports_color) {
        return `${p.label} cannot print color`;
      }
    }
    return null;
  }

  async function save() {
    setErr(null);
    setSaved(false);
    const validationErr = validateRouting();
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    setBusy(true);
    try {
      const body = {
        hours,
        slotDurationMin,
        maxPerSlot,
        binCount,
        premiumPercent,
        gstEnabled,
        gstNumber: gstNumber.trim(),
        pricing,
        printerConfig: { printers, stream_routing: routing } satisfies PrinterConfig,
      };
      const res = await fetch("/api/merchant/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErr(json.error ?? "Save failed");
      } else {
        setSaved(true);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <CMYKBar height={4} />
      <header className="container py-6 hairline-b">
        <div className="smallcaps text-ink/60">{shopName}</div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <div className="font-mono text-xs text-ink/60 mt-1">{shopId}</div>
      </header>

      <div className="container py-6 space-y-6 max-w-4xl pb-32">
        {err && (
          <div className="hairline border-status-failed text-status-failed p-3 text-sm">
            {err}
          </div>
        )}
        {saved && (
          <div className="hairline border-status-ready text-status-ready p-3 text-sm">
            Settings saved.
          </div>
        )}

        <HoursSection hours={hours} setHour={setHour} />

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Slots & capacity</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Slot duration</Label>
              <select
                value={slotDurationMin}
                onChange={(e) => setSlotDurationMin(Number(e.target.value))}
                className="hairline bg-paper h-11 px-3 font-mono text-sm w-full"
              >
                {SLOT_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Max jobs per slot</Label>
              <Input
                type="number"
                min={1}
                value={maxPerSlot}
                onChange={(e) => setMaxPerSlot(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Bin count</Label>
              <Input
                type="number"
                min={1}
                value={binCount}
                onChange={(e) => setBinCount(Number(e.target.value))}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Fees & GST</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Premium percent</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={premiumPercent}
                onChange={(e) => setPremiumPercent(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>GST enabled</Label>
              <button
                type="button"
                onClick={() => setGstEnabled((v) => !v)}
                className={cn(
                  "hairline h-11 px-4 font-mono text-sm w-full text-left transition-colors",
                  gstEnabled ? "bg-ink text-paper" : "bg-paper"
                )}
              >
                {gstEnabled ? "ON" : "OFF"}
              </button>
            </div>
            <div className="space-y-2">
              <Label>GST number</Label>
              <Input
                value={gstNumber}
                disabled={!gstEnabled}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="29ABCDE1234F1Z5"
              />
            </div>
          </CardBody>
        </Card>

        <PricingSection pricing={pricing} setPriceField={setPriceField} />

        <PrintersSection
          printers={printers}
          updatePrinter={updatePrinter}
          removePrinter={removePrinter}
          addPrinter={addPrinter}
        />

        <RoutingSection
          printers={printers}
          routing={routing}
          setRouting={setRouting}
        />

        <div className="sticky bottom-0 left-0 right-0 -mx-4 px-4 py-4 bg-paper hairline-t flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function normalizeHours(input: Record<string, unknown>): HoursMap {
  const out: HoursMap = {};
  for (const d of DAYS) {
    const v = input[d];
    if (v && typeof v === "object" && "open" in (v as object) && "close" in (v as object)) {
      const obj = v as { open: string; close: string };
      out[d] = { open: obj.open, close: obj.close };
    } else if (v && typeof v === "object" && "closed" in (v as object)) {
      out[d] = { closed: true };
    } else {
      out[d] = { open: "09:00", close: "18:00" };
    }
  }
  return out;
}

function HoursSection({
  hours,
  setHour,
}: {
  hours: HoursMap;
  setHour: (d: Day, next: HoursDay) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-bold">Operating hours</h2>
      </CardHeader>
      <CardBody className="space-y-3">
        {DAYS.map((d) => {
          const h = hours[d];
          const isClosed = "closed" in (h ?? {});
          return (
            <div key={d} className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-2 smallcaps text-ink/70 uppercase">{d}</div>
              <div className="col-span-2">
                <button
                  type="button"
                  onClick={() =>
                    setHour(
                      d,
                      isClosed ? { open: "09:00", close: "18:00" } : { closed: true }
                    )
                  }
                  className={cn(
                    "hairline h-11 px-3 font-mono text-xs w-full transition-colors",
                    isClosed ? "bg-ink text-paper" : "bg-paper"
                  )}
                >
                  {isClosed ? "CLOSED" : "OPEN"}
                </button>
              </div>
              <div className="col-span-4">
                <Input
                  type="time"
                  disabled={isClosed}
                  value={isClosed ? "" : (h as { open: string }).open}
                  onChange={(e) =>
                    setHour(d, { open: e.target.value, close: (h as { close: string }).close })
                  }
                />
              </div>
              <div className="col-span-4">
                <Input
                  type="time"
                  disabled={isClosed}
                  value={isClosed ? "" : (h as { close: string }).close}
                  onChange={(e) =>
                    setHour(d, { open: (h as { open: string }).open, close: e.target.value })
                  }
                />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function PricingSection({
  pricing,
  setPriceField,
}: {
  pricing: PricingConfig;
  setPriceField: (
    section: "plain" | "poster_glossy",
    color: "bw" | "color",
    size: "A4" | "A3" | "A2",
    rupees: number
  ) => void;
}) {
  const rows: Array<{
    section: "plain" | "poster_glossy";
    color: "bw" | "color";
    size: "A4" | "A3" | "A2";
    label: string;
    paise: number;
  }> = [
    { section: "plain", color: "bw", size: "A4", label: "Plain B&W A4 (per side)", paise: pricing.plain.bw.A4 },
    { section: "plain", color: "bw", size: "A3", label: "Plain B&W A3 (per side)", paise: pricing.plain.bw.A3 },
    { section: "plain", color: "color", size: "A4", label: "Plain Color A4 (per side)", paise: pricing.plain.color.A4 },
    { section: "plain", color: "color", size: "A3", label: "Plain Color A3 (per side)", paise: pricing.plain.color.A3 },
    { section: "poster_glossy", color: "color", size: "A4", label: "Glossy Poster Color A4 (per sheet)", paise: pricing.poster_glossy.color.A4 },
    { section: "poster_glossy", color: "color", size: "A2", label: "Glossy Poster Color A2 (per sheet)", paise: pricing.poster_glossy.color.A2 },
    { section: "poster_glossy", color: "bw", size: "A4", label: "Glossy Poster B&W A4 (per sheet)", paise: pricing.poster_glossy.bw.A4 },
    { section: "poster_glossy", color: "bw", size: "A2", label: "Glossy Poster B&W A2 (per sheet)", paise: pricing.poster_glossy.bw.A2 },
  ];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-bold">Pricing</h2>
        <p className="text-sm text-ink/60 mt-1">All values in rupees. Stored as paise.</p>
      </CardHeader>
      <CardBody className="space-y-3">
        {rows.map((r) => (
          <div key={`${r.section}-${r.color}-${r.size}`} className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-7 text-sm">{r.label}</div>
            <div className="col-span-5 flex items-center gap-2">
              <span className="text-ink/60 font-mono">₹</span>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={(r.paise / 100).toFixed(2)}
                onChange={(e) => setPriceField(r.section, r.color, r.size, Number(e.target.value))}
              />
            </div>
          </div>
        ))}
      </CardBody>
      <CardFooter>
        <div className="smallcaps text-ink/60">Duplex discount</div>
        <span className="ml-3 font-mono num">{pricing.duplex_discount_percent}%</span>
      </CardFooter>
    </Card>
  );
}

function PrintersSection({
  printers,
  updatePrinter,
  removePrinter,
  addPrinter,
}: {
  printers: Printer[];
  updatePrinter: (idx: number, patch: Partial<Printer>) => void;
  removePrinter: (idx: number) => void;
  addPrinter: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Printers</h2>
        <Button variant="secondary" onClick={addPrinter} size="sm">
          + Add printer
        </Button>
      </CardHeader>
      <CardBody className="space-y-4">
        {printers.length === 0 && (
          <p className="text-sm text-ink/60">No printers configured.</p>
        )}
        {printers.map((p, idx) => (
          <div key={p.id} className="hairline p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={p.label}
                  onChange={(e) => updatePrinter(idx, { label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>ID</Label>
                <Input
                  value={p.id}
                  onChange={(e) => updatePrinter(idx, { id: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePrinter(idx)}
                >
                  Remove
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <Toggle
                label="Color"
                value={p.supports_color}
                onChange={(v) => updatePrinter(idx, { supports_color: v })}
              />
              <Toggle
                label="Duplex"
                value={p.supports_duplex}
                onChange={(v) => updatePrinter(idx, { supports_duplex: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Paper types</Label>
              <div className="flex flex-wrap gap-2">
                {PAPER_TYPES.map((t) => (
                  <PillToggle
                    key={t}
                    label={t}
                    on={p.supported_paper_types.includes(t)}
                    onClick={() =>
                      updatePrinter(idx, {
                        supported_paper_types: toggleArr(p.supported_paper_types, t),
                      })
                    }
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Paper sizes</Label>
              <div className="flex flex-wrap gap-2">
                {PAPER_SIZES.map((s) => (
                  <PillToggle
                    key={s}
                    label={s}
                    on={p.supported_paper_sizes.includes(s)}
                    onClick={() =>
                      updatePrinter(idx, {
                        supported_paper_sizes: toggleArr(p.supported_paper_sizes, s),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function RoutingSection({
  printers,
  routing,
  setRouting,
}: {
  printers: Printer[];
  routing: Record<StreamKey, string>;
  setRouting: (next: Record<StreamKey, string>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-bold">Stream routing</h2>
        <p className="text-sm text-ink/60 mt-1">
          Each output stream maps to one printer.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        {STREAM_KEYS.map((k) => (
          <div key={k} className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-6 font-mono text-sm">{humanStreamLabel(k)}</div>
            <div className="col-span-6">
              <select
                value={routing[k] ?? ""}
                onChange={(e) => setRouting({ ...routing, [k]: e.target.value })}
                className="hairline bg-paper h-11 px-3 font-mono text-sm w-full"
              >
                <option value="">— select —</option>
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "smallcaps hairline px-3 py-1.5 transition-colors",
        value ? "bg-ink text-paper" : "bg-paper"
      )}
    >
      {label}: {value ? "ON" : "OFF"}
    </button>
  );
}

function PillToggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "smallcaps hairline px-3 py-1 transition-colors",
        on ? "bg-ink text-paper" : "bg-paper"
      )}
    >
      {label}
    </button>
  );
}

function toggleArr<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
