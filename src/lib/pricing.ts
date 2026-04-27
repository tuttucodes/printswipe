import { roundPaise } from "./format";
import { parseRangeSpec, PricingConfigSchema } from "./validation";
import type { FileSettings, PricingConfig } from "./types";

export interface PriceLine {
  label: string;
  calculation: string;
  paise: number;
}

export interface PriceResult {
  basePaise: number;
  premiumPaise: number;
  gstPaise: number;
  totalPaise: number;
  breakdown: PriceLine[];
}

/** Resolve color/bw page counts after applying page_range_spec and color_pages_spec. */
export function resolvePageBuckets(s: FileSettings): { color: number; bw: number; total: number } {
  const allPages = parseRangeSpec(s.pageRangeSpec ?? null, s.pageCount);
  if (s.colorMode === "ALL_COLOR") return { color: allPages.length, bw: 0, total: allPages.length };
  if (s.colorMode === "ALL_BW") return { color: 0, bw: allPages.length, total: allPages.length };
  // MIXED
  const colorPages = parseRangeSpec(s.colorPagesSpec ?? null, s.pageCount);
  const colorSet = new Set(colorPages);
  let c = 0, b = 0;
  for (const p of allPages) (colorSet.has(p) ? c++ : b++);
  return { color: c, bw: b, total: allPages.length };
}

function plainPerSidePaise(pricing: PricingConfig, color: "color" | "bw", size: "A4" | "A3", duplex: boolean): number {
  const base = pricing.plain[color][size];
  if (!duplex) return base;
  const discounted = base * (1 - pricing.plain ? pricing.duplex_discount_percent / 100 : 0);
  return Math.max(0, discounted);
}

function posterPerSheetPaise(pricing: PricingConfig, color: "color" | "bw", size: "A4" | "A2"): number {
  return pricing.poster_glossy[color][size];
}

/**
 * Compute price for one file. Returns base + breakdown lines.
 * Pure: no DB, no IO.
 */
export function priceForFile(s: FileSettings, pricing: PricingConfig, opts: { duplexCapable: boolean }): { paise: number; breakdown: PriceLine[] } {
  const buckets = resolvePageBuckets(s);
  const lines: PriceLine[] = [];
  let total = 0;

  const isDuplex = s.sides === "DOUBLE" && opts.duplexCapable;
  const layout = s.layout;

  if (s.paperType === "POSTER_GLOSSY") {
    const size = s.paperSize as "A4" | "A2";
    const color: "color" | "bw" = buckets.color > 0 ? "color" : "bw";
    const sheets = buckets.total; // 1-up, simplex
    const perSheet = posterPerSheetPaise(pricing, color, size);
    const subtotal = sheets * perSheet * s.copies;
    lines.push({
      label: `Poster ${size} ${color.toUpperCase()}`,
      calculation: `${sheets} sheet${sheets === 1 ? "" : "s"} × ${perSheet} paise × ${s.copies} = ${subtotal}`,
      paise: subtotal,
    });
    total += subtotal;
    return { paise: roundPaise(total), breakdown: lines };
  }

  // PLAIN: layout collapses pages onto sheets but cost is per side regardless
  const size = s.paperSize as "A4" | "A3";

  // Each "side" of paper = one slot. Layout > 1 stamps multiple source pages onto one side.
  // We bill per *output side*, where output_sides = ceil(pages_in_bucket / layout).
  // For mixed: bill color sides at color rate, bw sides at bw rate.
  if (buckets.color > 0) {
    const sides = Math.ceil(buckets.color / layout);
    const perSide = plainPerSidePaise(pricing, "color", size, isDuplex);
    const subtotal = roundPaise(sides * perSide) * s.copies;
    lines.push({
      label: `Plain ${size} COLOR ${isDuplex ? "duplex" : "simplex"}`,
      calculation: `${buckets.color}p ÷ ${layout}-up = ${sides} sides × ${perSide.toFixed(0)} paise × ${s.copies}`,
      paise: subtotal,
    });
    total += subtotal;
  }
  if (buckets.bw > 0) {
    const sides = Math.ceil(buckets.bw / layout);
    const perSide = plainPerSidePaise(pricing, "bw", size, isDuplex);
    const subtotal = roundPaise(sides * perSide) * s.copies;
    lines.push({
      label: `Plain ${size} B&W ${isDuplex ? "duplex" : "simplex"}`,
      calculation: `${buckets.bw}p ÷ ${layout}-up = ${sides} sides × ${perSide.toFixed(0)} paise × ${s.copies}`,
      paise: subtotal,
    });
    total += subtotal;
  }

  return { paise: roundPaise(total), breakdown: lines };
}

/** Aggregate: many files + premium + GST. */
export function priceJob(opts: {
  files: FileSettings[];
  pricing: unknown;
  premiumPercent: number;
  gstEnabled: boolean;
  gstPercent: number;
  duplexCapableMap: Record<string, boolean>; // streamKey → bool, or single fallback
  duplexCapableFallback?: boolean;
}): PriceResult {
  const pricing = PricingConfigSchema.parse(opts.pricing);
  const lines: PriceLine[] = [];
  let base = 0;
  for (const f of opts.files) {
    // Determine duplex capability per file from its routed stream
    const duplexCapable = opts.duplexCapableFallback ?? false;
    const r = priceForFile(f, pricing, { duplexCapable });
    base += r.paise;
    lines.push(...r.breakdown);
  }
  const premium = roundPaise((base * opts.premiumPercent) / 100);
  lines.push({ label: `Convenience fee (${opts.premiumPercent}%)`, calculation: `(${base} × ${opts.premiumPercent}%)`, paise: premium });
  let gst = 0;
  if (opts.gstEnabled) {
    gst = roundPaise(((base + premium) * opts.gstPercent) / 100);
    lines.push({ label: `GST (${opts.gstPercent}%)`, calculation: `(${base + premium} × ${opts.gstPercent}%)`, paise: gst });
  }
  return {
    basePaise: base,
    premiumPaise: premium,
    gstPaise: gst,
    totalPaise: base + premium + gst,
    breakdown: lines,
  };
}
