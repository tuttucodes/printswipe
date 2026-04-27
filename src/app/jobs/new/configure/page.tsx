"use client";
import { StepIndicator } from "@/components/StepIndicator";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useJobDraft } from "@/hooks/useJobDraft";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CMYKBar } from "@/components/CMYKBar";
import { Wordmark } from "@/components/Wordmark";
import { PriceDisplay } from "@/components/PriceDisplay";
import { PrintPreview } from "@/components/PrintPreview";
import { priceForFile } from "@/lib/pricing";
import { PricingConfigSchema, parseRangeSpec, tryParseRangeSpec } from "@/lib/validation";
import type {
  ColorMode,
  FileSettings,
  Layout,
  Orientation,
  PaperSize,
  PaperType,
  PricingConfig,
  PrinterConfig,
  Sides,
  StreamKey,
} from "@/lib/types";
import { paperColorKey } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ShopConfig {
  pricing: PricingConfig;
  printerConfig: PrinterConfig;
  premiumPercent: number;
  gstEnabled: boolean;
}

function streamSupportsDuplex(printerConfig: PrinterConfig, key: StreamKey): boolean {
  const printerId = printerConfig.stream_routing[key];
  const printer = printerConfig.printers.find((p) => p.id === printerId);
  return printer?.supports_duplex ?? false;
}

function deriveStreamKey(s: FileSettings): StreamKey {
  // Use color/bw based on color mode for stream lookup
  const color: "color" | "bw" = s.colorMode === "ALL_BW" ? "bw" : "color";
  return paperColorKey(s.paperType, s.paperSize, color);
}

export default function NewJobConfigurePage() {
  const router = useRouter();
  const shopId = useJobDraft((s) => s.shopId);
  const slotIso = useJobDraft((s) => s.slotIso);
  const files = useJobDraft((s) => s.files);
  const updateSettings = useJobDraft((s) => s.updateSettings);
  const removeFile = useJobDraft((s) => s.removeFile);
  const [shopCfg, setShopCfg] = useState<ShopConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(files[0]?.id ?? null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) router.push("/jobs/new/shop");
    else if (!slotIso) router.push("/jobs/new/slot");
    else if (files.length === 0) router.push("/jobs/new/files");
  }, [shopId, slotIso, files.length, router]);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    const run = async () => {
      const sb = createClient();
      const { data, error: shopErr } = await sb
        .from("shops")
        .select("pricing_json, printer_config_json, premium_percent, gst_enabled")
        .eq("id", shopId)
        .single();
      if (cancelled) return;
      if (shopErr || !data) {
        setError(shopErr?.message ?? "Shop not found.");
        return;
      }
      try {
        const pricing = PricingConfigSchema.parse(data.pricing_json);
        setShopCfg({
          pricing,
          printerConfig: data.printer_config_json as PrinterConfig,
          premiumPercent: Number(data.premium_percent),
          gstEnabled: data.gst_enabled,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invalid shop config.");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  if (!shopCfg) {
    return (
      <main className="min-h-[100dvh] pb-12">
        <CMYKBar height={4} />
        <section className="container py-12 text-center text-ink/60">
          {error ? <span className="text-accent font-mono">{error}</span> : "Loading…"}
        </section>
      </main>
    );
  }

  const total = files.reduce((acc, f) => {
    const streamKey = deriveStreamKey(f.settings);
    const duplexCapable = streamSupportsDuplex(shopCfg.printerConfig, streamKey);
    try {
      const r = priceForFile(f.settings, shopCfg.pricing, { duplexCapable });
      return acc + r.paise;
    } catch {
      return acc;
    }
  }, 0);

  const allValid = files.every((f) => {
    if (f.settings.colorMode === "MIXED") {
      try {
        parseRangeSpec(f.settings.colorPagesSpec ?? null, f.settings.pageCount);
      } catch {
        return false;
      }
    }
    if (f.settings.pageRangeSpec) {
      try {
        parseRangeSpec(f.settings.pageRangeSpec, f.settings.pageCount);
      } catch {
        return false;
      }
    }
    return true;
  });

  return (
    <main className="min-h-[100dvh] pb-32">
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-5 w-auto text-ink" />
        <Link href="/jobs/new/files" className="smallcaps text-ink/60 hover:text-ink">
          ← Back
        </Link>
      </header>

      <section className="container py-4">
        <StepIndicator current={4} />
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">Tell us how to print.</h1>
      </section>

      <section className="container py-4">
        <ul className="grid gap-3">
          {files.map((f) => {
            const open = openId === f.id;
            const streamKey = deriveStreamKey(f.settings);
            const duplexCapable = streamSupportsDuplex(shopCfg.printerConfig, streamKey);
            let priceLine = 0;
            let priceErr: string | null = null;
            try {
              priceLine = priceForFile(f.settings, shopCfg.pricing, { duplexCapable }).paise;
            } catch (e) {
              priceErr = e instanceof Error ? e.message : "Pricing error";
            }
            return (
              <li key={f.id}>
                <Card>
                  <CardHeader className="!p-4 sm:!p-5">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : f.id)}
                      className="flex flex-col sm:flex-row w-full items-start sm:items-center sm:justify-between gap-3 text-left"
                    >
                      <div className="min-w-0 w-full">
                        <div className="font-mono text-sm font-bold truncate">{f.filename}</div>
                        <div className="font-mono text-xs text-ink/60 num mt-1">
                          {f.pageCount} pages · {f.settings.paperType === "POSTER_GLOSSY" ? "Poster" : "Plain"}{" "}
                          {f.settings.paperSize} · ×{f.settings.copies}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                        {priceErr ? (
                          <span className="font-mono text-xs text-accent">err</span>
                        ) : (
                          <PriceDisplay paise={priceLine} size="sm" />
                        )}
                        <span className="smallcaps text-ink/60">{open ? "Hide" : "Edit"}</span>
                      </div>
                    </button>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPreviewId(f.id); }}
                        className="smallcaps text-ink/60 hover:text-accent transition-colors min-h-9 px-2 cursor-pointer"
                      >
                        ⌘ Preview
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Remove "${f.filename}" from this job?`)) {
                            removeFile(f.id);
                          }
                        }}
                        className="smallcaps text-status-failed hover:underline transition-colors min-h-9 px-2 cursor-pointer"
                        aria-label={`Remove ${f.filename}`}
                      >
                        Remove
                      </button>
                    </div>
                  </CardHeader>
                  {open && (
                    <CardBody className="grid gap-5">
                      <FileConfigEditor
                        settings={f.settings}
                        duplexCapable={duplexCapable}
                        onChange={(p) => updateSettings(f.id, p)}
                      />
                      {priceErr && (
                        <p className="font-mono text-xs text-accent">{priceErr}</p>
                      )}
                    </CardBody>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="fixed bottom-0 left-0 right-0 bg-paper hairline-t z-30 pb-[env(safe-area-inset-bottom)]">
        <div className="container py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 min-w-0">
            <span className="smallcaps text-ink/60">Estimate</span>
            <PriceDisplay paise={total} size="md" />
          </div>
          <Button
            variant="accent"
            size="lg"
            disabled={!allValid}
            onClick={() => router.push("/jobs/new/review")}
            className="shrink-0"
          >
            Review
          </Button>
        </div>
      </div>

      {previewId && (() => {
        const f = files.find((x) => x.id === previewId);
        if (!f) return null;
        return (
          <PrintPreview
            open
            filename={f.filename}
            settings={f.settings}
            onClose={() => setPreviewId(null)}
          />
        );
      })()}
    </main>
  );
}

interface FileConfigEditorProps {
  settings: FileSettings;
  duplexCapable: boolean;
  onChange: (partial: Partial<FileSettings>) => void;
}

function FileConfigEditor({ settings, duplexCapable, onChange }: FileConfigEditorProps) {
  const isPoster = settings.paperType === "POSTER_GLOSSY";

  const setPaperType = (paperType: PaperType) => {
    if (paperType === "POSTER_GLOSSY") {
      onChange({
        paperType,
        paperSize: settings.paperSize === "A4" ? "A4" : "A2",
        sides: "SINGLE",
        layout: 1,
        colorMode: settings.colorMode === "MIXED" ? "ALL_COLOR" : settings.colorMode,
        orientation: "PORTRAIT",
      });
    } else {
      onChange({
        paperType,
        paperSize: settings.paperSize === "A2" ? "A4" : settings.paperSize,
      });
    }
  };

  const sizeOptions: PaperSize[] = isPoster ? ["A4", "A2"] : ["A4", "A3"];
  const colorOptions: { value: ColorMode; label: string }[] = isPoster
    ? [
        { value: "ALL_COLOR", label: "Color" },
        { value: "ALL_BW", label: "B&W" },
      ]
    : [
        { value: "ALL_COLOR", label: "All Color" },
        { value: "ALL_BW", label: "All B&W" },
        { value: "MIXED", label: "Mixed" },
      ];

  return (
    <div className="grid gap-5">
      <Field label="Paper Type">
        <RadioRow
          options={[
            { value: "PLAIN", label: "Plain" },
            { value: "POSTER_GLOSSY", label: "Glossy Poster" },
          ]}
          value={settings.paperType}
          onChange={(v) => setPaperType(v as PaperType)}
        />
      </Field>

      <Field label="Paper Size">
        <RadioRow
          options={sizeOptions.map((s) => ({ value: s, label: s }))}
          value={settings.paperSize}
          onChange={(v) => onChange({ paperSize: v as PaperSize })}
        />
      </Field>

      <Field label="Color Mode">
        <RadioRow
          options={colorOptions}
          value={settings.colorMode}
          onChange={(v) => onChange({ colorMode: v as ColorMode })}
        />
      </Field>

      {settings.colorMode === "MIXED" && (
        <Field label={`Color pages (of ${settings.pageCount})`}>
          <Input
            placeholder="1, 3, 7-9"
            value={settings.colorPagesSpec ?? ""}
            onChange={(e) => onChange({ colorPagesSpec: e.target.value })}
            aria-invalid={(() => {
              const r = tryParseRangeSpec(settings.colorPagesSpec ?? null, settings.pageCount);
              return !r.ok;
            })()}
          />
          {(() => {
            const r = tryParseRangeSpec(settings.colorPagesSpec ?? null, settings.pageCount);
            if (!r.ok) {
              return (
                <p className="text-xs text-status-failed font-mono mt-2">{r.error}</p>
              );
            }
            return (
              <p className="text-xs text-ink/60 font-mono mt-2 num">
                {r.pages.length} color · {settings.pageCount - r.pages.length} B&amp;W
              </p>
            );
          })()}
        </Field>
      )}

      {!isPoster && (
        <Field label="Sides">
          <RadioRow
            options={[
              { value: "SINGLE", label: "Single" },
              { value: "DOUBLE", label: "Double", disabled: !duplexCapable },
            ]}
            value={settings.sides}
            onChange={(v) => onChange({ sides: v as Sides })}
          />
          {!duplexCapable && (
            <p className="text-xs text-ink/60 font-mono mt-2">
              This shop's printer doesn't support duplex for this stream.
            </p>
          )}
        </Field>
      )}

      {!isPoster && (
        <Field label="Layout">
          <RadioRow
            options={[1, 2, 4, 6].map((n) => ({ value: String(n), label: `${n}-up` }))}
            value={String(settings.layout)}
            onChange={(v) => onChange({ layout: Number(v) as Layout })}
          />
        </Field>
      )}

      <Field label="Copies">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Decrease copies"
            onClick={() => onChange({ copies: Math.max(1, settings.copies - 1) })}
            disabled={settings.copies <= 1}
            className="w-11 h-11 hairline font-mono text-lg disabled:opacity-30"
          >
            −
          </button>
          <span className="font-mono num font-bold text-xl w-12 text-center" aria-live="polite">
            {settings.copies}
          </span>
          <button
            type="button"
            aria-label="Increase copies"
            onClick={() => onChange({ copies: Math.min(50, settings.copies + 1) })}
            disabled={settings.copies >= 50}
            className="w-11 h-11 hairline font-mono text-lg disabled:opacity-30"
          >
            +
          </button>
        </div>
      </Field>

      <Field label={`Page Range (of ${settings.pageCount})`}>
        <Input
          placeholder="All (or e.g. 1-5, 8)"
          value={settings.pageRangeSpec ?? ""}
          onChange={(e) => onChange({ pageRangeSpec: e.target.value || null })}
          aria-invalid={(() => {
            if (!settings.pageRangeSpec) return false;
            return !tryParseRangeSpec(settings.pageRangeSpec, settings.pageCount).ok;
          })()}
        />
        {(() => {
          if (!settings.pageRangeSpec) {
            return (
              <p className="text-xs text-ink/60 font-mono mt-2 num">
                All {settings.pageCount} page{settings.pageCount === 1 ? "" : "s"} will be printed.
              </p>
            );
          }
          const r = tryParseRangeSpec(settings.pageRangeSpec, settings.pageCount);
          if (!r.ok) {
            return <p className="text-xs text-status-failed font-mono mt-2">{r.error}</p>;
          }
          return (
            <p className="text-xs text-ink/60 font-mono mt-2 num">
              {r.pages.length} page{r.pages.length === 1 ? "" : "s"} selected.
            </p>
          );
        })()}
      </Field>

      {!isPoster && (
        <Field label="Orientation">
          <RadioRow
            options={[
              { value: "PORTRAIT", label: "Portrait" },
              { value: "LANDSCAPE", label: "Landscape" },
            ]}
            value={settings.orientation}
            onChange={(v) => onChange({ orientation: v as Orientation })}
          />
        </Field>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <span className="smallcaps text-ink/60">{label}</span>
      {children}
    </div>
  );
}

interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function RadioRow({
  options,
  value,
  onChange,
}: {
  options: RadioOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            type="button"
            key={o.value}
            disabled={o.disabled}
            onClick={() => !o.disabled && onChange(o.value)}
            className={cn(
              "hairline px-3 min-h-11 flex items-center font-mono text-sm transition-colors",
              active && !o.disabled && "bg-ink text-paper",
              !active && !o.disabled && "hover:bg-ink/5",
              o.disabled && "opacity-30 cursor-not-allowed"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
