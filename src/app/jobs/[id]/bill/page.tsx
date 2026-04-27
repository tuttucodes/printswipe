import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { Footer } from "@/components/Footer";
import { BillClient } from "./BillClient";
import { formatSlotIST, formatTimeIST, maskPhone } from "@/lib/format";
import {
  paperColorKey,
  humanStreamLabel,
  type PaperType,
  type PaperSize,
  type ColorMode,
  type Sides,
  type StreamKey,
} from "@/lib/types";

interface FileRow {
  filename: string;
  page_count: number;
  paper_type: PaperType;
  paper_size: PaperSize;
  color_mode: ColorMode;
  color_pages_spec: string | null;
  sides: Sides;
  layout: number;
  copies: number;
}

interface JobRow {
  id: string;
  token: string | null;
  slot_time: string;
  status: string;
  bin_number: number | null;
  total_amount_paise: number;
  premium_amount_paise: number;
  gst_amount_paise: number;
  razorpay_payment_id: string | null;
  created_at: string;
  shops: { name: string; location_desc: string | null } | null;
  job_files: FileRow[];
  profiles: { name: string | null; email: string; phone: string | null; campuses: { name: string } | null } | null;
}

export default async function BillPage({ params }: { params: { id: string } }) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await sb
    .from("jobs")
    .select(
      "id, token, slot_time, status, bin_number, total_amount_paise, premium_amount_paise, gst_amount_paise, razorpay_payment_id, created_at, shops(name, location_desc), job_files(filename, page_count, paper_type, paper_size, color_mode, color_pages_spec, sides, layout, copies), profiles(name, email, phone, campuses(name))"
    )
    .eq("id", params.id)
    .single();

  if (!data) {
    return (
      <AppShell>
        <section className="container py-16 text-center">
          <h1 className="text-3xl font-bold">Bill not found.</h1>
          <p className="text-ink/60 mt-2">This job may have been removed or doesn't belong to you.</p>
          <Link href="/jobs" className="smallcaps text-accent mt-6 inline-block">
            ← Back to jobs
          </Link>
        </section>
        <Footer />
      </AppShell>
    );
  }

  const job = data as unknown as JobRow;

  // Build line items from job_files (one row per file with effective count)
  const items = (job.job_files ?? []).map((f) => {
    const streamKey: StreamKey =
      f.paper_type === "POSTER_GLOSSY"
        ? f.paper_size === "A4"
          ? "poster_a4"
          : "poster_a2"
        : paperColorKey(
            "PLAIN",
            f.paper_size,
            f.color_mode === "ALL_COLOR" || f.color_mode === "MIXED" ? "color" : "bw"
          );

    const sheetsPerCopy = Math.ceil(f.page_count / f.layout);
    const totalSheets = sheetsPerCopy * f.copies;

    return {
      name: `${f.filename} — ${humanStreamLabel(streamKey)}`,
      qty: totalSheets,
      // Rate is total / qty (for display only — stored math is canonical via subtotal)
      rate: 0,
      amount: 0,
    };
  });

  // Distribute base across items proportionally to sheet count
  const totalSheets = items.reduce((s, i) => s + i.qty, 0) || 1;
  const base = job.total_amount_paise - job.premium_amount_paise - job.gst_amount_paise;
  let allocated = 0;
  items.forEach((it, idx) => {
    if (idx === items.length - 1) {
      it.amount = base - allocated;
    } else {
      const share = Math.round((it.qty / totalSheets) * base);
      it.amount = share;
      allocated += share;
    }
    it.rate = it.qty > 0 ? Math.round(it.amount / it.qty) : 0;
  });

  const billData = {
    brand: "PRINTSWIPE",
    shopName: job.shops?.name ?? "Print shop",
    shopLocation: job.shops?.location_desc ?? null,
    token: job.token ?? "—",
    jobId: job.id,
    binNumber: job.bin_number,
    customerName: job.profiles?.name ?? "—",
    customerPhoneMasked: maskPhone(job.profiles?.phone ?? null),
    customerEmail: job.profiles?.email ?? user.email ?? "",
    campusName: job.profiles?.campuses?.name ?? null,
    slotTime: formatSlotIST(job.slot_time),
    paidAt: formatTimeIST(job.created_at),
    paymentRef: job.razorpay_payment_id,
    items,
    basePaise: base,
    premiumPaise: job.premium_amount_paise,
    gstPaise: job.gst_amount_paise,
    totalPaise: job.total_amount_paise,
    status: job.status,
  };

  return (
    <AppShell>
      <section className="container py-3">
        <Link href={`/jobs/${job.id}`} className="smallcaps text-ink/60 hover:text-ink">
          ← Back
        </Link>
      </section>
      <section className="container py-6 flex justify-center">
        <BillClient data={billData} jobId={job.id} />
      </section>
      <Footer />
    </AppShell>
  );
}
