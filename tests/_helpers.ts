import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BundlerFile, BundlerJob } from "../src/lib/bundler";
import type { FileSettings, PrinterConfig } from "../src/lib/types";

export const FULL_DUPLEX_PRINTERS: PrinterConfig = {
  printers: [
    { id: "p1", label: "HP M283", supports_color: false, supported_paper_types: ["PLAIN"], supported_paper_sizes: ["A4", "A3"], supports_duplex: true },
    { id: "p2", label: "Canon C3226i", supports_color: true, supported_paper_types: ["PLAIN"], supported_paper_sizes: ["A4", "A3"], supports_duplex: true },
    { id: "p3", label: "Epson P700", supports_color: true, supported_paper_types: ["POSTER_GLOSSY"], supported_paper_sizes: ["A4"], supports_duplex: false },
    { id: "p4", label: "Epson T3170M", supports_color: true, supported_paper_types: ["POSTER_GLOSSY"], supported_paper_sizes: ["A2"], supports_duplex: false },
  ],
  stream_routing: { bw_a4: "p1", bw_a3: "p1", color_a4: "p2", color_a3: "p2", poster_a4: "p3", poster_a2: "p4" },
};

export const NO_DUPLEX_PRINTERS: PrinterConfig = {
  printers: [
    { id: "p1", label: "BasicMono", supports_color: false, supported_paper_types: ["PLAIN"], supported_paper_sizes: ["A4", "A3"], supports_duplex: false },
    { id: "p2", label: "BasicColor", supports_color: true, supported_paper_types: ["PLAIN"], supported_paper_sizes: ["A4", "A3"], supports_duplex: false },
    { id: "p3", label: "PosterA4", supports_color: true, supported_paper_types: ["POSTER_GLOSSY"], supported_paper_sizes: ["A4"], supports_duplex: false },
    { id: "p4", label: "PosterA2", supports_color: true, supported_paper_types: ["POSTER_GLOSSY"], supported_paper_sizes: ["A2"], supports_duplex: false },
  ],
  stream_routing: { bw_a4: "p1", bw_a3: "p1", color_a4: "p2", color_a3: "p2", poster_a4: "p3", poster_a2: "p4" },
};

/** Create a synthetic PDF with N pages of A4 (or specified size). */
export async function makeSourcePdf(pages: number, label = "P"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`${label} ${i}`, { x: 250, y: 400, size: 36, font, color: rgb(0, 0, 0) });
  }
  return doc.save();
}

export function defaultSettings(over: Partial<FileSettings> = {}): FileSettings {
  return {
    paperType: "PLAIN",
    paperSize: "A4",
    colorMode: "ALL_BW",
    sides: "DOUBLE",
    layout: 1,
    copies: 1,
    pageRangeSpec: null,
    colorPagesSpec: null,
    orientation: "PORTRAIT",
    pageCount: 1,
    ...over,
  };
}

export async function makeFile(
  id: string,
  filename: string,
  pageCount: number,
  settings: Partial<FileSettings> = {}
): Promise<BundlerFile> {
  return {
    id,
    filename,
    bytes: await makeSourcePdf(pageCount, filename[0]),
    settings: defaultSettings({ pageCount, ...settings }),
  };
}

export function makeJob(id: string, token: string, name: string, files: BundlerFile[]): BundlerJob {
  return {
    id,
    token,
    studentName: name,
    studentPhoneMasked: "•••••1234",
    slotTime: new Date("2026-04-28T08:00:00Z"),
    slotTimeLabel: "1:30 PM, Tue 28 Apr",
    files,
  };
}
