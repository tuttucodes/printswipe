import { PDFDocument } from "pdf-lib";
import { renderCoverPage, renderTailPage } from "./coverPage";
import { addBlankPage, appendWithLayout, PAGE_DIMS } from "./pdf-utils";
import { parseRangeSpec } from "./validation";
import {
  STREAM_KEYS,
  humanStreamLabel,
  paperColorKey,
  type FileSettings,
  type PrinterConfig,
  type StreamKey,
} from "./types";
import { formatToken } from "./tokens";

// =========================================================================
// Public types
// =========================================================================

export interface BundlerJob {
  id: string;
  token: string;
  studentName: string;
  studentPhoneMasked?: string;
  slotTime: Date;
  slotTimeLabel: string;
  files: BundlerFile[];
}

export interface BundlerFile {
  id: string;
  filename: string;
  bytes: Uint8Array;          // pre-fetched PDF bytes (image files must be pre-converted)
  settings: FileSettings;
}

export interface BundlerInput {
  shopId: string;
  shopName: string;
  binCount: number;
  printerConfig: PrinterConfig;
  jobs: BundlerJob[];          // already in token order, with bin assigned upstream
  binAssignments: Record<string, number>; // jobId → binNumber
  batchId: string;
}

export interface BundleStream {
  key: StreamKey;
  paperType: "PLAIN" | "POSTER_GLOSSY";
  paperSize: "A4" | "A3" | "A2";
  colorBucket: "color" | "bw" | "mixed";
  isDuplex: boolean;
  printerId: string;
  printerLabel: string;
  pdfBytes: Uint8Array;
  pageCount: number;
  sheetCount: number;
  instructions: string;
}

export interface BundleResult {
  batchId: string;
  streams: BundleStream[];
  binAssignments: Array<{
    jobId: string;
    token: string;
    studentName: string;
    binNumber: number;
    streamContributions: Record<string, { pageCount: number; sheetCount: number }>;
  }>;
  manifestJson: object;
}

// =========================================================================
// Stream contribution analysis
// =========================================================================

interface FileStreamPlan {
  fileId: string;
  filename: string;
  streamKey: StreamKey;
  pageIndices: number[];   // 0-indexed within source
  settings: FileSettings;
}

/** Determine which streams a single file contributes to and which page indices to each. */
export function planFileStreams(file: BundlerFile): FileStreamPlan[] {
  const s = file.settings;
  const pages = parseRangeSpec(s.pageRangeSpec ?? null, s.pageCount); // 1-indexed
  const out: FileStreamPlan[] = [];

  if (s.paperType === "POSTER_GLOSSY") {
    const color = s.colorMode === "ALL_BW" ? "bw" : "color";
    out.push({
      fileId: file.id,
      filename: file.filename,
      streamKey: paperColorKey("POSTER_GLOSSY", s.paperSize, color),
      pageIndices: pages.map((p) => p - 1),
      settings: s,
    });
    return out;
  }

  // PLAIN
  if (s.colorMode === "ALL_COLOR" || s.colorMode === "ALL_BW") {
    const color = s.colorMode === "ALL_COLOR" ? "color" : "bw";
    out.push({
      fileId: file.id,
      filename: file.filename,
      streamKey: paperColorKey("PLAIN", s.paperSize, color),
      pageIndices: pages.map((p) => p - 1),
      settings: s,
    });
    return out;
  }

  // MIXED: split pages
  const colorPages = parseRangeSpec(s.colorPagesSpec ?? null, s.pageCount);
  const colorSet = new Set(colorPages);
  const inColor = pages.filter((p) => colorSet.has(p));
  const inBW = pages.filter((p) => !colorSet.has(p));
  if (inColor.length > 0) {
    out.push({
      fileId: file.id,
      filename: file.filename,
      streamKey: paperColorKey("PLAIN", s.paperSize, "color"),
      pageIndices: inColor.map((p) => p - 1),
      settings: s,
    });
  }
  if (inBW.length > 0) {
    out.push({
      fileId: file.id,
      filename: file.filename,
      streamKey: paperColorKey("PLAIN", s.paperSize, "bw"),
      pageIndices: inBW.map((p) => p - 1),
      settings: s,
    });
  }
  return out;
}

function isPlainStream(k: StreamKey): boolean {
  return k.startsWith("bw_") || k.startsWith("color_");
}

function isBwPlain(k: StreamKey): boolean {
  return k === "bw_a4" || k === "bw_a3";
}

function isColorPlain(k: StreamKey): boolean {
  return k === "color_a4" || k === "color_a3";
}

function streamPaperSize(k: StreamKey): "A4" | "A3" | "A2" {
  if (k.endsWith("_a4")) return "A4";
  if (k.endsWith("_a3")) return "A3";
  return "A2";
}

function streamPaperType(k: StreamKey): "PLAIN" | "POSTER_GLOSSY" {
  return k.startsWith("poster_") ? "POSTER_GLOSSY" : "PLAIN";
}

function streamColorBucket(k: StreamKey): "color" | "bw" | "mixed" {
  if (k.startsWith("color_")) return "color";
  if (k.startsWith("bw_")) return "bw";
  return "mixed";
}

// =========================================================================
// Cover stream selection
// =========================================================================
//
// Every plain stream a job touches gets its own cover + tail in pure ink.
// Posters never carry covers (don't waste glossy paper).
// If a job is poster-only, we synthesize a stub bw_a4 stream just for the
// boundary marker so the merchant can pair it with the poster output.

const PLAIN_PRIORITY: readonly StreamKey[] = ["bw_a4", "color_a4", "bw_a3", "color_a3"];

export function fallbackCoverStream(): StreamKey {
  return "bw_a4";
}

// =========================================================================
// The bundler
// =========================================================================

export async function bundleBatch(input: BundlerInput): Promise<BundleResult> {
  const { jobs, printerConfig, binAssignments, shopName, batchId } = input;

  // Initialize per-stream documents lazily
  const streamDocs = new Map<StreamKey, PDFDocument>();
  const streamPageCounts = new Map<StreamKey, number>(); // running count for sheet math
  const contributionsByJob: Record<string, Record<string, { pageCount: number; sheetCount: number }>> = {};

  for (const job of jobs) {
    contributionsByJob[job.id] = {};

    // Plan all file→stream contributions for this job
    const allPlans: FileStreamPlan[] = job.files.flatMap((f) => planFileStreams(f));

    const plainStreamSet = new Set<StreamKey>(
      allPlans.filter((p) => isPlainStream(p.streamKey)).map((p) => p.streamKey)
    );
    const allStreamSet = new Set(allPlans.map((p) => p.streamKey));

    // Streams this job touches. If the job has NO plain content (e.g. poster
    // only), we synthesize a stub bw_a4 stream that carries ONLY cover + tail
    // so the merchant has a paper with bin info to pair with the poster output.
    const jobStreams = new Set<StreamKey>(allStreamSet);
    const stubBwForCover = plainStreamSet.size === 0 && allStreamSet.size > 0;
    if (stubBwForCover) jobStreams.add(fallbackCoverStream());

    for (const streamKey of jobStreams) {
      const doc = await ensureStream(streamDocs, streamKey);
      const isPlain = isPlainStream(streamKey);
      const isDuplex = isPlain && getRoutedDuplex(printerConfig, streamKey);
      const paperSize = streamPaperSize(streamKey);
      const isBw = isBwPlain(streamKey);
      const isColor = isColorPlain(streamKey);
      const isStubOnly = stubBwForCover && streamKey === fallbackCoverStream() && !allStreamSet.has(streamKey);

      // ----- Cover (every plain stream + stubs; minimal style for color) -----
      if (isPlain) {
        const otherStreamLabels = [...allStreamSet]
          .filter((k) => k !== streamKey)
          .map((k) => humanStreamLabel(k));

        const fileManifestForCover = isStubOnly
          ? mergeFileManifest(allPlans, job.files)
          : mergeFileManifest(
              allPlans.filter((p) => p.streamKey === streamKey),
              job.files
            );

        const coverBytes = await renderCoverPage({
          token: job.token,
          studentName: job.studentName,
          studentPhoneMasked: job.studentPhoneMasked,
          binNumber: binAssignments[job.id] ?? 0,
          slotTimeLabel: job.slotTimeLabel,
          shopName,
          streamLabel: humanStreamLabel(streamKey),
          fileManifest: fileManifestForCover,
          otherStreams: otherStreamLabels,
          qrPayload: JSON.stringify({ token: job.token, jobId: job.id, batchId, stream: streamKey }),
          minimal: isColor,
        });
        const coverDoc = await PDFDocument.load(coverBytes);
        const [coverPage] = await doc.copyPages(coverDoc, [0]);
        doc.addPage(coverPage);
        if (isDuplex) addBlankPage(doc, paperSize);
      }

      // ----- Content (skip for stub-only streams) -----
      const plansForStream = isStubOnly
        ? []
        : allPlans.filter((p) => p.streamKey === streamKey);

      for (const plan of plansForStream) {
        const file = job.files.find((f) => f.id === plan.fileId)!;
        const srcDoc = await PDFDocument.load(file.bytes);
        const interleaveBlankBack = isDuplex && plan.settings.sides === "SINGLE";

        for (let copy = 0; copy < plan.settings.copies; copy++) {
          const beforeCount = doc.getPageCount();
          await appendWithLayout({
            destDoc: doc,
            srcDoc,
            srcIndices: plan.pageIndices,
            layout: plan.settings.layout,
            paperSize,
            orientation: plan.settings.orientation,
            interleaveBlankBack,
          });
          if (isDuplex && plan.settings.sides === "DOUBLE") {
            const added = doc.getPageCount() - beforeCount;
            if (added % 2 !== 0) addBlankPage(doc, paperSize);
          }
        }
      }

      // ----- Tail (every plain stream gets one; minimal for color) -----
      if (isPlain) {
        const tailBytes = await renderTailPage({
          token: job.token,
          studentName: job.studentName,
          binNumber: binAssignments[job.id] ?? 0,
          qrPayload: JSON.stringify({ token: job.token, jobId: job.id, batchId, end: true }),
          minimal: isColor,
        });
        const tailDoc = await PDFDocument.load(tailBytes);
        const [tailPage] = await doc.copyPages(tailDoc, [0]);
        doc.addPage(tailPage);
        if (isDuplex) addBlankPage(doc, paperSize);

        if (isDuplex && doc.getPageCount() % 2 !== 0) addBlankPage(doc, paperSize);
      }

      // Track contribution counts for the manifest
      const contributedPages = plansForStream.reduce((sum, p) => sum + p.pageIndices.length * p.settings.copies, 0);
      const cur = contributionsByJob[job.id][streamKey] ?? { pageCount: 0, sheetCount: 0 };
      cur.pageCount += contributedPages;
      cur.sheetCount += isDuplex
        ? Math.ceil(contributedPages / 2)
        : contributedPages;
      contributionsByJob[job.id][streamKey] = cur;
    }
  }

  // Finalize streams
  const streams: BundleStream[] = [];
  for (const key of STREAM_KEYS) {
    const doc = streamDocs.get(key);
    if (!doc || doc.getPageCount() === 0) continue;
    const printerId = printerConfig.stream_routing[key];
    const printer = printerConfig.printers.find((p) => p.id === printerId);
    if (!printer) throw new Error(`Stream ${key} routes to unknown printer ${printerId}`);
    const isDuplex = isPlainStream(key) && printer.supports_duplex;

    const pdfBytes = await doc.save();
    const pageCount = doc.getPageCount();
    const sheetCount = isDuplex ? Math.ceil(pageCount / 2) : pageCount;

    streams.push({
      key,
      paperType: streamPaperType(key),
      paperSize: streamPaperSize(key),
      colorBucket: streamColorBucket(key),
      isDuplex,
      printerId,
      printerLabel: printer.label,
      pdfBytes,
      pageCount,
      sheetCount,
      instructions: isDuplex
        ? "Print double-sided, long edge"
        : "Print single-sided",
    });
  }

  const result: BundleResult = {
    batchId,
    streams,
    binAssignments: jobs.map((j) => ({
      jobId: j.id,
      token: j.token,
      studentName: j.studentName,
      binNumber: binAssignments[j.id] ?? 0,
      streamContributions: contributionsByJob[j.id] ?? {},
    })),
    manifestJson: {
      shopId: input.shopId,
      shopName,
      batchId,
      jobIds: jobs.map((j) => j.id),
      streamSummary: streams.map((s) => ({
        key: s.key,
        printerLabel: s.printerLabel,
        pageCount: s.pageCount,
        sheetCount: s.sheetCount,
        instructions: s.instructions,
      })),
    },
  };
  return result;
}

// =========================================================================
// helpers
// =========================================================================

async function ensureStream(map: Map<StreamKey, PDFDocument>, key: StreamKey): Promise<PDFDocument> {
  const existing = map.get(key);
  if (existing) return existing;
  const created = await PDFDocument.create();
  map.set(key, created);
  return created;
}

function mergeFileManifest(
  plans: FileStreamPlan[],
  files: BundlerFile[]
): { filename: string; pageCount: number }[] {
  const by = new Map<string, number>();
  for (const p of plans) {
    const f = files.find((f) => f.id === p.fileId);
    if (!f) continue;
    by.set(f.filename, (by.get(f.filename) ?? 0) + p.pageIndices.length * p.settings.copies);
  }
  return [...by.entries()].map(([filename, pageCount]) => ({ filename, pageCount }));
}

function getRoutedDuplex(cfg: PrinterConfig, key: StreamKey): boolean {
  const printerId = cfg.stream_routing[key];
  const printer = cfg.printers.find((p) => p.id === printerId);
  return Boolean(printer?.supports_duplex);
}
