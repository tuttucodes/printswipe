import { z } from "zod";

export const PaperTypeSchema = z.enum(["PLAIN", "POSTER_GLOSSY"]);
export const PaperSizeSchema = z.enum(["A4", "A3", "A2"]);
export const ColorModeSchema = z.enum(["ALL_COLOR", "ALL_BW", "MIXED"]);
export const SidesSchema = z.enum(["SINGLE", "DOUBLE"]);
export const LayoutSchema = z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(6)]);
export const OrientationSchema = z.enum(["AUTO", "PORTRAIT", "LANDSCAPE"]);

export const PageRangeSchema = z
  .string()
  .regex(/^[\d,\-\s]*$/u, "Use digits, commas, and dashes only.")
  .max(200);

/** Parse "1,3,7-9" to a sorted, deduped array of 1-indexed page numbers. */
export function parseRangeSpec(spec: string | null | undefined, pageCount: number): number[] {
  if (!spec || !spec.trim()) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const out = new Set<number>();
  for (const seg of spec.split(",")) {
    const s = seg.trim();
    if (!s) continue;
    if (s.includes("-")) {
      const [a, b] = s.split("-").map((x) => Number(x.trim()));
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`bad range: ${s}`);
      const lo = Math.min(a, b), hi = Math.max(a, b);
      for (let i = lo; i <= hi; i++) out.add(i);
    } else {
      const n = Number(s);
      if (!Number.isFinite(n)) throw new Error(`bad page: ${s}`);
      out.add(n);
    }
  }
  const arr = [...out].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  if (arr.length === 0) throw new Error("page range produced 0 pages");
  return arr;
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
    orientation: OrientationSchema.default("AUTO"),
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
