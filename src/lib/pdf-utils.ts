import { PDFDocument, PDFPage, PDFEmbeddedPage, degrees, rgb } from "pdf-lib";
import type { PaperSize, Layout, Orientation } from "./types";

export const PAGE_DIMS: Record<PaperSize, [number, number]> = {
  A4: [595, 842],
  A3: [842, 1191],
  A2: [1191, 1684],
};

export function addBlankPage(doc: PDFDocument, size: PaperSize): PDFPage {
  return doc.addPage(PAGE_DIMS[size]);
}

/**
 * Append source pages onto the dest doc with optional N-up tiling, orientation,
 * and (when in a duplex stream) blank-back interleave for single-sided content.
 *
 * Returns the count of *output* pages added including any interleaved blanks.
 */
export async function appendWithLayout(opts: {
  destDoc: PDFDocument;
  srcDoc: PDFDocument;
  srcIndices: number[];
  layout: Layout;
  paperSize: PaperSize;
  orientation: Orientation;
  /** insert a blank back after each output sheet (used in duplex streams for SINGLE sides) */
  interleaveBlankBack?: boolean;
}): Promise<number> {
  const { destDoc, srcDoc, srcIndices, layout, paperSize, orientation, interleaveBlankBack } = opts;
  if (srcIndices.length === 0) return 0;

  // 1-up portrait: direct copy preserves source dimensions when matching paper
  if (layout === 1 && orientation === "PORTRAIT") {
    const copied = await destDoc.copyPages(srcDoc, srcIndices);
    let n = 0;
    for (const p of copied) {
      destDoc.addPage(p);
      n++;
      if (interleaveBlankBack) {
        addBlankPage(destDoc, paperSize);
        n++;
      }
    }
    return n;
  }

  // N-up or oriented: embed source then stamp into cells
  const embedded = await destDoc.embedPdf(await srcDoc.save(), srcIndices);
  let outputW = PAGE_DIMS[paperSize][0];
  let outputH = PAGE_DIMS[paperSize][1];
  if (orientation === "LANDSCAPE") [outputW, outputH] = [outputH, outputW];

  const cells = layoutCells(layout, outputW, outputH);
  let n = 0;
  for (let i = 0; i < embedded.length; i += cells.length) {
    const page = destDoc.addPage([outputW, outputH]);
    for (let c = 0; c < cells.length && i + c < embedded.length; c++) {
      const cell = cells[c];
      const emb = embedded[i + c] as PDFEmbeddedPage;
      const srcW = emb.width, srcH = emb.height;
      const scale = Math.min(cell.w / srcW, cell.h / srcH);
      const drawW = srcW * scale, drawH = srcH * scale;
      const dx = cell.x + (cell.w - drawW) / 2;
      const dy = cell.y + (cell.h - drawH) / 2;
      page.drawPage(emb, { x: dx, y: dy, xScale: scale, yScale: scale });
    }
    n++;
    if (interleaveBlankBack) {
      addBlankPage(destDoc, paperSize);
      n++;
    }
  }
  return n;
}

function layoutCells(layout: Layout, w: number, h: number): { x: number; y: number; w: number; h: number }[] {
  const margin = 12;
  const innerW = w - margin * 2;
  const innerH = h - margin * 2;
  switch (layout) {
    case 1:
      return [{ x: margin, y: margin, w: innerW, h: innerH }];
    case 2: {
      const cellH = innerH / 2;
      return [
        { x: margin, y: margin + cellH, w: innerW, h: cellH },
        { x: margin, y: margin, w: innerW, h: cellH },
      ];
    }
    case 4: {
      const cw = innerW / 2, ch = innerH / 2;
      return [
        { x: margin, y: margin + ch, w: cw, h: ch },
        { x: margin + cw, y: margin + ch, w: cw, h: ch },
        { x: margin, y: margin, w: cw, h: ch },
        { x: margin + cw, y: margin, w: cw, h: ch },
      ];
    }
    case 6: {
      const cw = innerW / 2, ch = innerH / 3;
      return [
        { x: margin, y: margin + 2 * ch, w: cw, h: ch },
        { x: margin + cw, y: margin + 2 * ch, w: cw, h: ch },
        { x: margin, y: margin + ch, w: cw, h: ch },
        { x: margin + cw, y: margin + ch, w: cw, h: ch },
        { x: margin, y: margin, w: cw, h: ch },
        { x: margin + cw, y: margin, w: cw, h: ch },
      ];
    }
  }
}

/** Draw the right + top black "L" boundary bands on a portrait A4 page.
 * Pass `minimal: true` for color streams to use thin bands (saves toner). */
export function drawBoundaryBands(page: PDFPage, opts: { minimal?: boolean } = {}) {
  const w = page.getWidth();
  const h = page.getHeight();
  const band = opts.minimal ? 8 : 71;
  page.drawRectangle({ x: 0, y: h - band, width: w, height: band, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: w - band, y: 0, width: band, height: h, color: rgb(0, 0, 0) });
}
