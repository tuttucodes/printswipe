import { z } from "zod";

export const PaperTypeSchema = z.enum(["PLAIN", "POSTER_GLOSSY"]);
export const PaperSizeSchema = z.enum(["A4", "A3", "A2"]);
export const ColorModeSchema = z.enum(["ALL_COLOR", "ALL_BW", "MIXED"]);
export const SidesSchema = z.enum(["SINGLE", "DOUBLE"]);
export const LayoutSchema = z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(6)]);
export const OrientationSchema = z.enum(["PORTRAIT", "LANDSCAPE"]);

export const PageRangeSchema = z
  .string()
  .regex(/^[\d,\-\s]*$/u, "Use digits, commas, and dashes only.")
  .max(200);

/**
 * Parse "1,3,7-9" to a sorted, deduped array of 1-indexed page numbers.
 * Strict: rejects out-of-bounds references with a precise error message
 * so the UI can show the user which page number is wrong.
 */
export function parseRangeSpec(spec: string | null | undefined, pageCount: number): number[] {
  if (pageCount <= 0) throw new Error("page count must be > 0");

  if (!spec || !spec.trim()) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const out = new Set<number>();
  for (const segRaw of spec.split(",")) {
    const seg = segRaw.trim();
    if (!seg) continue;

    if (seg.includes("-")) {
      const parts = seg.split("-").map((x) => x.trim());
      if (parts.length !== 2 || parts.some((p) => p === "")) {
        throw new Error(`Bad range "${seg}". Use the form 5-9.`);
      }
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (!Number.isInteger(a) || !Number.isInteger(b)) {
        throw new Error(`Bad range "${seg}". Pages must be whole numbers.`);
      }
      if (a < 1 || b < 1) {
        throw new Error(`Range "${seg}" includes a page below 1.`);
      }
      const hi = Math.max(a, b);
      if (hi > pageCount) {
        throw new Error(`Range "${seg}" exceeds the document — only ${pageCount} page${pageCount === 1 ? "" : "s"} available.`);
      }
      const lo = Math.min(a, b);
      for (let i = lo; i <= hi; i++) out.add(i);
    } else {
      const n = Number(seg);
      if (!Number.isInteger(n)) {
        throw new Error(`"${seg}" is not a whole page number.`);
      }
      if (n < 1) {
        throw new Error(`Page ${n} is below 1.`);
      }
      if (n > pageCount) {
        throw new Error(`Page ${n} doesn't exist — only ${pageCount} page${pageCount === 1 ? "" : "s"} available.`);
      }
      out.add(n);
    }
  }

  if (out.size === 0) {
    throw new Error("No pages selected.");
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Try-parse helper. Returns either resolved pages or an error message.
 * Used by UI for inline feedback without try/catch noise.
 */
export function tryParseRangeSpec(
  spec: string | null | undefined,
  pageCount: number
): { ok: true; pages: number[] } | { ok: false; error: string } {
  try {
    return { ok: true, pages: parseRangeSpec(spec, pageCount) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid range." };
  }
}

export const FileSettingsSchema = z
  .object({
    paperType: PaperTypeSchema,
    paperSize: PaperSizeSchema,
    colorMode: ColorModeSchema,
    colorPagesSpec: z.string().nullable().optional(),
    sides: SidesSchema,
    layout: LayoutSchema,
    copies: z.number().int().min(1).max(50),
    pageRangeSpec: z.string().nullable().optional(),
    orientation: OrientationSchema.default("PORTRAIT"),
    pageCount: z.number().int().positive(),
  })
  .superRefine((s, ctx) => {
    if (s.paperType === "PLAIN" && !["A4", "A3"].includes(s.paperSize)) {
      ctx.addIssue({ code: "custom", message: "PLAIN supports A4/A3", path: ["paperSize"] });
    }
    if (s.paperType === "POSTER_GLOSSY") {
      if (!["A4", "A2"].includes(s.paperSize)) {
        ctx.addIssue({ code: "custom", message: "POSTER supports A4/A2", path: ["paperSize"] });
      }
      if (s.sides !== "SINGLE") {
        ctx.addIssue({ code: "custom", message: "POSTER must be single-sided", path: ["sides"] });
      }
      if (s.layout !== 1) {
        ctx.addIssue({ code: "custom", message: "POSTER must be 1-up", path: ["layout"] });
      }
      if (s.colorMode === "MIXED") {
        ctx.addIssue({ code: "custom", message: "POSTER cannot be mixed-color", path: ["colorMode"] });
      }
    }
    if (s.colorMode === "MIXED" && !s.colorPagesSpec?.trim()) {
      ctx.addIssue({ code: "custom", message: "color pages spec required when MIXED", path: ["colorPagesSpec"] });
    }
  });

export type FileSettings = z.infer<typeof FileSettingsSchema>;

export const PricingConfigSchema = z.object({
  plain: z.object({
    bw: z.object({ A4: z.number().int().nonnegative(), A3: z.number().int().nonnegative() }),
    color: z.object({ A4: z.number().int().nonnegative(), A3: z.number().int().nonnegative() }),
  }),
  poster_glossy: z.object({
    color: z.object({ A4: z.number().int().nonnegative(), A2: z.number().int().nonnegative() }),
    bw: z.object({ A4: z.number().int().nonnegative(), A2: z.number().int().nonnegative() }),
  }),
  duplex_discount_percent: z.number().min(0).max(100),
  currency: z.literal("INR"),
});

export const PrinterSchema = z.object({
  id: z.string(),
  label: z.string(),
  supports_color: z.boolean(),
  supported_paper_types: z.array(PaperTypeSchema),
  supported_paper_sizes: z.array(PaperSizeSchema),
  supports_duplex: z.boolean(),
});

export const PrinterConfigSchema = z.object({
  printers: z.array(PrinterSchema).min(1),
  stream_routing: z.object({
    bw_a4: z.string(),
    color_a4: z.string(),
    bw_a3: z.string(),
    color_a3: z.string(),
    poster_a4: z.string(),
    poster_a2: z.string(),
  }),
});

export const HoursSchema = z.record(
  z.union([z.object({ open: z.string(), close: z.string() }), z.object({ closed: z.literal(true) })])
);

export const IndianMobile = z.string().regex(/^(\+91)?[6-9]\d{9}$/u, "Enter a 10-digit Indian mobile.");
