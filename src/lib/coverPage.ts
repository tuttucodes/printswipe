import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { drawBoundaryBands, PAGE_DIMS } from "./pdf-utils";

// pdf-lib supports characterSpacing at runtime but its TS types omit it.
type DrawTextOpts = Parameters<PDFPage["drawText"]>[1] & { characterSpacing?: number };
function drawText(page: PDFPage, text: string, opts: DrawTextOpts) {
  return page.drawText(text, opts as Parameters<PDFPage["drawText"]>[1]);
}

export interface CoverInput {
  token: string;
  studentName: string;
  studentPhoneMasked?: string;
  binNumber: number;
  slotTimeLabel: string;
  shopName: string;
  streamLabel: string;
  fileManifest: { filename: string; pageCount: number }[];
  otherStreams: string[];
  qrPayload: string;
}

export interface TailInput {
  token: string;
  studentName: string;
  binNumber: number;
  qrPayload: string;
}

const ACCENT = rgb(239 / 255, 51 / 255, 64 / 255);
const INK = rgb(0.04, 0.04, 0.04);

async function pngFromQr(payload: string): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 0, scale: 8 });
  const b64 = dataUrl.split(",")[1];
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

/** Render a single A4 cover page document and return its bytes. */
export async function renderCoverPage(input: CoverInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PAGE_DIMS.A4);
  drawBoundaryBands(page);

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const courier = await doc.embedFont(StandardFonts.Courier);
  const courierBold = await doc.embedFont(StandardFonts.CourierBold);

  // Wordmark
  drawText(page, "PRINTSWIPE", { x: 40, y: 770, size: 12, font: courierBold, color: INK, characterSpacing: 4 });
  page.drawLine({ start: { x: 40, y: 760 }, end: { x: 524, y: 760 }, color: INK, thickness: 0.7 });

  // Token block
  const tokenLabel = "TOKEN";
  drawText(page, tokenLabel, {
    x: (595 - helv.widthOfTextAtSize(tokenLabel, 10)) / 2,
    y: 720,
    size: 10,
    font: helvBold,
    color: INK,
    characterSpacing: 3,
  });
  const tokenW = courierBold.widthOfTextAtSize(input.token, 110);
  page.drawText(input.token, {
    x: (524 - tokenW) / 2,
    y: 600,
    size: 110,
    font: courierBold,
    color: INK,
  });

  // QR
  const qrBytes = await pngFromQr(input.qrPayload);
  const qrImg = await doc.embedPng(qrBytes);
  const qrSize = 140;
  page.drawImage(qrImg, { x: (524 - qrSize) / 2, y: 440, width: qrSize, height: qrSize });

  // Student
  drawText(page, "STUDENT", { x: 40, y: 410, size: 9, font: helvBold, color: INK, characterSpacing: 2.5 });
  page.drawText(input.studentName, { x: 40, y: 388, size: 18, font: helvBold, color: INK });
  if (input.studentPhoneMasked) {
    drawText(page, "PHONE", { x: 40, y: 368, size: 8, font: helvBold, color: INK, characterSpacing: 2.5 });
    page.drawText(input.studentPhoneMasked, { x: 40, y: 352, size: 11, font: courier, color: INK });
  }

  // Bin badge
  const badgeY = 280, badgeH = 70, badgeW = 280, badgeX = (524 - badgeW) / 2;
  page.drawRectangle({ x: badgeX, y: badgeY, width: badgeW, height: badgeH, color: ACCENT });
  const binText = `BIN ${input.binNumber}`;
  const binW = courierBold.widthOfTextAtSize(binText, 44);
  page.drawText(binText, {
    x: badgeX + (badgeW - binW) / 2,
    y: badgeY + 20,
    size: 44,
    font: courierBold,
    color: rgb(1, 1, 1),
  });

  // Stream
  drawText(page, "STREAM", { x: 40, y: 250, size: 9, font: helvBold, color: INK, characterSpacing: 2.5 });
  page.drawText(input.streamLabel, { x: 40, y: 232, size: 14, font: helvBold, color: INK });

  // Shop / slot
  drawText(page, "SHOP", { x: 40, y: 210, size: 9, font: helvBold, color: INK, characterSpacing: 2.5 });
  page.drawText(`${input.shopName} · ${input.slotTimeLabel}`, { x: 40, y: 195, size: 10, font: helv, color: INK });

  // File manifest
  drawText(page, "IN THIS STACK", { x: 40, y: 175, size: 9, font: helvBold, color: INK, characterSpacing: 2.5 });
  let y = 158;
  for (const f of input.fileManifest.slice(0, 8)) {
    drawClipped(page, helv, `• ${f.filename} — ${f.pageCount} ${f.pageCount === 1 ? "page" : "pages"}`, 40, y, 10, 460);
    y -= 13;
  }

  if (input.otherStreams.length) {
    y -= 5;
    drawText(page, `ALSO IN BIN ${input.binNumber}`, { x: 40, y, size: 9, font: helvBold, color: INK, characterSpacing: 2.5 });
    y -= 13;
    for (const s of input.otherStreams.slice(0, 4)) {
      drawClipped(page, helv, `• ${s}`, 40, y, 10, 460);
      y -= 13;
    }
  }

  // Bottom marker
  const start = ">>  START OF JOB  <<";
  const startW = helvBold.widthOfTextAtSize(start, 12);
  page.drawText(start, {
    x: (524 - startW) / 2,
    y: 50,
    size: 12,
    font: helvBold,
    color: INK,
  });

  return doc.save();
}

export async function renderTailPage(input: TailInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PAGE_DIMS.A4);
  drawBoundaryBands(page);

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const courierBold = await doc.embedFont(StandardFonts.CourierBold);

  const endTop = ">>  END OF JOB  <<";
  page.drawText(endTop, {
    x: (524 - helvBold.widthOfTextAtSize(endTop, 12)) / 2,
    y: 700,
    size: 12, font: helvBold, color: INK,
  });

  drawText(page, "END OF TOKEN", {
    x: (524 - helvBold.widthOfTextAtSize("END OF TOKEN", 12)) / 2,
    y: 660,
    size: 12, font: helvBold, color: INK, characterSpacing: 3,
  });

  const tokenW = courierBold.widthOfTextAtSize(input.token, 64);
  page.drawText(input.token, {
    x: (524 - tokenW) / 2,
    y: 580,
    size: 64, font: courierBold, color: INK,
  });

  const nameW = helv.widthOfTextAtSize(input.studentName, 14);
  page.drawText(input.studentName, {
    x: (524 - nameW) / 2,
    y: 540,
    size: 14, font: helv, color: INK,
  });

  const binText = `BIN ${input.binNumber}`;
  const binW = courierBold.widthOfTextAtSize(binText, 28);
  page.drawText(binText, {
    x: (524 - binW) / 2,
    y: 500,
    size: 28, font: courierBold, color: ACCENT,
  });

  // QR (smaller)
  const qrBytes = await pngFromQr(input.qrPayload);
  const qrImg = await doc.embedPng(qrBytes);
  page.drawImage(qrImg, { x: (524 - 80) / 2, y: 380, width: 80, height: 80 });

  const dashed = "- - - - - - - - - - - - - - - - - - - - - - - -";
  const dashW = helv.widthOfTextAtSize(dashed, 12);
  page.drawText(dashed, {
    x: (524 - dashW) / 2,
    y: 340,
    size: 12, font: helv, color: INK,
  });

  drawText(page, "PRINTSWIPE", {
    x: 40, y: 50, size: 9, font: helvBold, color: INK, characterSpacing: 4,
  });

  return doc.save();
}

function drawClipped(page: any, font: PDFFont, text: string, x: number, y: number, size: number, maxW: number) {
  let t = text;
  while (font.widthOfTextAtSize(t, size) > maxW && t.length > 4) t = t.slice(0, -2);
  if (t.length < text.length) t = t + "…";
  page.drawText(t, { x, y, size, font, color: INK });
}
