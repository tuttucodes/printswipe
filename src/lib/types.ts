// Shared types used across server + client.

export const PaperType = { PLAIN: "PLAIN", POSTER_GLOSSY: "POSTER_GLOSSY" } as const;
export type PaperType = (typeof PaperType)[keyof typeof PaperType];

export const PaperSize = { A4: "A4", A3: "A3", A2: "A2" } as const;
export type PaperSize = (typeof PaperSize)[keyof typeof PaperSize];

export const ColorMode = { ALL_COLOR: "ALL_COLOR", ALL_BW: "ALL_BW", MIXED: "MIXED" } as const;
export type ColorMode = (typeof ColorMode)[keyof typeof ColorMode];

export const Sides = { SINGLE: "SINGLE", DOUBLE: "DOUBLE" } as const;
export type Sides = (typeof Sides)[keyof typeof Sides];

export type Layout = 1 | 2 | 4 | 6;

export const Orientation = { PORTRAIT: "PORTRAIT", LANDSCAPE: "LANDSCAPE" } as const;
export type Orientation = (typeof Orientation)[keyof typeof Orientation];

export type JobStatus =
  | "PENDING_PAYMENT"
  | "SCHEDULED"
  | "BUNDLED"
  | "PRINTED"
  | "READY"
  | "COLLECTED"
  | "EXPIRED"
  | "FAILED"
  | "REFUNDED";

export const STREAM_KEYS = ["bw_a4", "color_a4", "bw_a3", "color_a3", "poster_a4", "poster_a2"] as const;
export type StreamKey = (typeof STREAM_KEYS)[number];

export interface Printer {
  id: string;
  label: string;
  supports_color: boolean;
  supported_paper_types: PaperType[];
  supported_paper_sizes: PaperSize[];
  supports_duplex: boolean;
}

export interface PrinterConfig {
  printers: Printer[];
  stream_routing: Record<StreamKey, string>;
}

export interface PricingConfig {
  plain: { bw: { A4: number; A3: number }; color: { A4: number; A3: number } };
  poster_glossy: { color: { A4: number; A2: number }; bw: { A4: number; A2: number } };
  duplex_discount_percent: number;
  currency: "INR";
}

export interface FileSettings {
  paperType: PaperType;
  paperSize: PaperSize;
  colorMode: ColorMode;
  colorPagesSpec?: string | null;
  sides: Sides;
  layout: Layout;
  copies: number;
  pageRangeSpec?: string | null;
  orientation: Orientation;
  pageCount: number;
}

// Stream key derivation
export function paperColorKey(t: PaperType, s: PaperSize, color: "color" | "bw"): StreamKey {
  if (t === "POSTER_GLOSSY") return s === "A4" ? "poster_a4" : "poster_a2";
  if (s === "A4") return color === "color" ? "color_a4" : "bw_a4";
  if (s === "A3") return color === "color" ? "color_a3" : "bw_a3";
  throw new Error(`unsupported paper combo ${t}/${s}`);
}

export function humanStreamLabel(k: StreamKey): string {
  const map: Record<StreamKey, string> = {
    bw_a4: "PLAIN A4 — BLACK & WHITE",
    color_a4: "PLAIN A4 — COLOR",
    bw_a3: "PLAIN A3 — BLACK & WHITE",
    color_a3: "PLAIN A3 — COLOR",
    poster_a4: "GLOSSY POSTER — A4",
    poster_a2: "GLOSSY POSTER — A2",
  };
  return map[k];
}
