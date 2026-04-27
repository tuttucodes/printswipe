import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { formatSlotIST, formatDateIST, paiseToRupees } from "@/lib/format";

export const runtime = "nodejs";

interface ReceiptJob {
  id: string;
  token: string | null;
  slot_time: string;
  status: string;
  total_amount_paise: number;
  premium_amount_paise: number;
  gst_amount_paise: number;
  created_at: string;
  razorpay_payment_id: string | null;
  shops: { name: string; location_desc: string | null; gst_number: string | null } | null;
  job_files: Array<{
    filename: string;
    page_count: number;
    paper_type: string;
    paper_size: string;
    color_mode: string;
    sides: string;
    layout: number;
    copies: number;
  }>;
}

interface RouteParams {
  params: { jobId: string };
}

export async function GET(_req: Request, { params }: RouteParams) {
  const supa = createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supa
    .from("jobs")
    .select(
      "id, token, slot_time, status, total_amount_paise, premium_amount_paise, gst_amount_paise, created_at, razorpay_payment_id, shops(name, location_desc, gst_number), job_files(filename, page_count, paper_type, paper_size, color_mode, sides, layout, copies)"
    )
    .eq("id", params.jobId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  const job = data as unknown as ReceiptJob;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]); // A5 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const ink = rgb(0.04, 0.04, 0.04);
  const muted = rgb(0.4, 0.4, 0.4);

  let y = 555;
  page.drawText("PRINTSWIPE", {
    x: 24,
    y,
    size: 16,
    font: bold,
    color: ink,
  });
  page.drawText("RECEIPT", { x: 340, y, size: 10, font, color: muted });

  y -= 8;
  page.drawLine({ start: { x: 24, y }, end: { x: 396, y }, thickness: 0.5, color: ink });

  y -= 28;
  page.drawText(`Token`, { x: 24, y, size: 8, font, color: muted });
  page.drawText(job.token ?? "—", { x: 24, y: y - 14, size: 18, font: bold, color: ink });

  page.drawText(`Job ID`, { x: 220, y, size: 8, font, color: muted });
  page.drawText(job.id.slice(0, 18), { x: 220, y: y - 14, size: 9, font: mono, color: ink });

  y -= 42;
  page.drawText("Shop", { x: 24, y, size: 8, font, color: muted });
  page.drawText(job.shops?.name ?? "—", { x: 24, y: y - 12, size: 11, font: bold, color: ink });
  if (job.shops?.location_desc) {
    page.drawText(job.shops.location_desc.slice(0, 60), {
      x: 24,
      y: y - 26,
      size: 9,
      font,
      color: muted,
    });
  }

  y -= 48;
  page.drawText("Slot", { x: 24, y, size: 8, font, color: muted });
  page.drawText(formatSlotIST(job.slot_time), { x: 24, y: y - 12, size: 10, font, color: ink });

  page.drawText("Status", { x: 220, y, size: 8, font, color: muted });
  page.drawText(job.status, { x: 220, y: y - 12, size: 10, font: bold, color: ink });

  y -= 36;
  page.drawText("Files", { x: 24, y, size: 8, font, color: muted });
  y -= 14;
  for (const f of job.job_files ?? []) {
    if (y < 160) break;
    page.drawText(f.filename.slice(0, 50), { x: 24, y, size: 9, font: mono, color: ink });
    y -= 12;
    const meta = `${f.page_count}p · ${f.paper_type === "POSTER_GLOSSY" ? "Poster" : "Plain"} ${f.paper_size} · ${f.color_mode.replace("_", " ")} · ${f.sides} · ${f.layout}-up · x${f.copies}`;
    page.drawText(meta, { x: 24, y, size: 8, font, color: muted });
    y -= 16;
  }

  y -= 8;
  page.drawLine({ start: { x: 24, y }, end: { x: 396, y }, thickness: 0.5, color: ink });

  y -= 18;
  const baseAmount = job.total_amount_paise - job.premium_amount_paise - job.gst_amount_paise;
  const rows: Array<[string, string]> = [
    ["Subtotal", paiseToRupees(baseAmount)],
    ["Convenience fee", paiseToRupees(job.premium_amount_paise)],
  ];
  if (job.gst_amount_paise > 0) {
    rows.push(["GST", paiseToRupees(job.gst_amount_paise)]);
  }
  for (const [label, amount] of rows) {
    page.drawText(label, { x: 24, y, size: 9, font, color: muted });
    page.drawText(amount, { x: 396, y, size: 9, font: mono, color: ink });
    // Right-align
    const w = mono.widthOfTextAtSize(amount, 9);
    page.drawText(amount, { x: 396 - w, y, size: 9, font: mono, color: ink });
    y -= 14;
  }

  y -= 4;
  page.drawLine({ start: { x: 24, y }, end: { x: 396, y }, thickness: 0.5, color: ink });
  y -= 18;
  page.drawText("Total", { x: 24, y, size: 11, font: bold, color: ink });
  const totalStr = paiseToRupees(job.total_amount_paise);
  const wTotal = mono.widthOfTextAtSize(totalStr, 11);
  page.drawText(totalStr, { x: 396 - wTotal, y, size: 11, font: bold, color: ink });

  y -= 36;
  if (job.razorpay_payment_id) {
    page.drawText(`Payment: ${job.razorpay_payment_id}`, {
      x: 24,
      y,
      size: 7,
      font: mono,
      color: muted,
    });
    y -= 10;
  }
  if (job.shops?.gst_number) {
    page.drawText(`GSTIN: ${job.shops.gst_number}`, { x: 24, y, size: 7, font: mono, color: muted });
    y -= 10;
  }
  page.drawText(`Issued: ${formatDateIST(job.created_at)}`, {
    x: 24,
    y,
    size: 7,
    font: mono,
    color: muted,
  });

  page.drawText("printswipe.in", { x: 24, y: 24, size: 7, font, color: muted });
  page.drawText("Thank you.", { x: 340, y: 24, size: 7, font, color: muted });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="printswipe-receipt-${(job.token ?? job.id).slice(0, 12)}.pdf"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
