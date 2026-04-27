import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bundleBatch, type BundlerJob, type BundlerFile } from "@/lib/bundler";
import { PrinterConfigSchema } from "@/lib/validation";
import { formatTimeIST, maskPhone } from "@/lib/format";
import type { FileSettings, PrinterConfig } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const BUCKET_FILES = "job-files";
const BUCKET_BATCHES = "print-batches";
const SIGNED_URL_TTL_SECONDS = 4 * 60 * 60;

const Body = z.object({
  shopId: z.string().uuid(),
  jobIds: z.array(z.string().uuid()).min(1).max(50),
});

interface JobFileRow {
  id: string;
  filename: string;
  storage_path: string;
  page_count: number;
  paper_type: string;
  paper_size: string;
  color_mode: string;
  color_pages_spec: string | null;
  sides: string;
  layout: number;
  copies: number;
  page_range_spec: string | null;
  orientation: string;
  order_index: number;
}

interface JobRow {
  id: string;
  token: string | null;
  slot_time: string;
  status: string;
  user_id: string;
  shop_id: string;
}

export async function POST(req: Request) {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().formErrors.join(", ") || "invalid body" },
      { status: 400 }
    );
  }

  const { shopId, jobIds } = parsed.data;

  // Verify caller is a merchant for this shop
  const { data: merchantLink } = await sb
    .from("merchants")
    .select("id, shop_id")
    .eq("profile_id", user.id)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!merchantLink) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Load shop config
  const { data: shop, error: shopErr } = await admin
    .from("shops")
    .select("id, name, bin_count, printer_config_json")
    .eq("id", shopId)
    .single();
  if (shopErr || !shop) {
    return NextResponse.json({ success: false, error: "shop not found" }, { status: 404 });
  }

  const printerConfigParsed = PrinterConfigSchema.safeParse(shop.printer_config_json);
  if (!printerConfigParsed.success) {
    return NextResponse.json(
      { success: false, error: "shop printer_config_json is invalid" },
      { status: 500 }
    );
  }
  const printerConfig: PrinterConfig = printerConfigParsed.data;

  // Load jobs
  const { data: jobRows, error: jobErr } = await admin
    .from("jobs")
    .select("id, token, slot_time, status, user_id, shop_id")
    .in("id", jobIds)
    .eq("shop_id", shopId);
  if (jobErr || !jobRows || jobRows.length === 0) {
    return NextResponse.json({ success: false, error: "no jobs" }, { status: 404 });
  }
  const eligible = jobRows.filter((j) => j.status === "SCHEDULED");
  if (eligible.length === 0) {
    return NextResponse.json(
      { success: false, error: "no SCHEDULED jobs in selection" },
      { status: 400 }
    );
  }
  // Sort by slot_time, then token
  eligible.sort((a, b) => {
    const t = a.slot_time.localeCompare(b.slot_time);
    if (t !== 0) return t;
    return (a.token ?? "").localeCompare(b.token ?? "");
  });

  // Load profiles
  const userIds = [...new Set(eligible.map((j) => j.user_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, phone")
    .in("id", userIds);
  const profileMap = new Map<string, { name: string | null; phone: string | null }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id as string, {
      name: (p.name as string | null) ?? null,
      phone: (p.phone as string | null) ?? null,
    });
  }

  // Load files for all jobs
  const { data: fileRows, error: fileErr } = await admin
    .from("job_files")
    .select(
      "id, job_id, filename, storage_path, page_count, paper_type, paper_size, color_mode, color_pages_spec, sides, layout, copies, page_range_spec, orientation, order_index"
    )
    .in("job_id", eligible.map((j) => j.id))
    .is("deleted_at", null)
    .order("order_index", { ascending: true });
  if (fileErr) {
    return NextResponse.json({ success: false, error: fileErr.message }, { status: 500 });
  }

  const filesByJob = new Map<string, JobFileRow[]>();
  for (const f of (fileRows ?? []) as Array<JobFileRow & { job_id: string }>) {
    const arr = filesByJob.get(f.job_id);
    if (arr) arr.push(f);
    else filesByJob.set(f.job_id, [f]);
  }

  // Download file bytes
  const bundlerJobs: BundlerJob[] = [];
  const binAssignments: Record<string, number> = {};
  let binCursor = 1;
  const binMax = Math.max(1, shop.bin_count as number);

  for (const job of eligible as JobRow[]) {
    const profile = profileMap.get(job.user_id);
    const studentName = profile?.name ?? "Student";
    const phoneMasked = maskPhone(profile?.phone);
    const slotDate = new Date(job.slot_time);

    const jobFiles = filesByJob.get(job.id) ?? [];
    const bundlerFiles: BundlerFile[] = [];
    for (const f of jobFiles) {
      const dl = await admin.storage.from(BUCKET_FILES).download(f.storage_path);
      if (dl.error || !dl.data) {
        return NextResponse.json(
          { success: false, error: `download failed for ${f.filename}` },
          { status: 500 }
        );
      }
      const arrayBuf = await dl.data.arrayBuffer();
      const settings: FileSettings = {
        paperType: f.paper_type as FileSettings["paperType"],
        paperSize: f.paper_size as FileSettings["paperSize"],
        colorMode: f.color_mode as FileSettings["colorMode"],
        colorPagesSpec: f.color_pages_spec,
        sides: f.sides as FileSettings["sides"],
        layout: f.layout as FileSettings["layout"],
        copies: f.copies,
        pageRangeSpec: f.page_range_spec,
        orientation: f.orientation as FileSettings["orientation"],
        pageCount: f.page_count,
      };
      bundlerFiles.push({
        id: f.id,
        filename: f.filename,
        bytes: new Uint8Array(arrayBuf),
        settings,
      });
    }

    bundlerJobs.push({
      id: job.id,
      token: job.token ?? "",
      studentName,
      studentPhoneMasked: phoneMasked,
      slotTime: slotDate,
      slotTimeLabel: formatTimeIST(slotDate),
      files: bundlerFiles,
    });

    binAssignments[job.id] = ((binCursor - 1) % binMax) + 1;
    binCursor++;
  }

  // Bundle
  const batchId = crypto.randomUUID();
  let result;
  try {
    result = await bundleBatch({
      shopId,
      shopName: shop.name as string,
      binCount: binMax,
      printerConfig,
      jobs: bundlerJobs,
      binAssignments,
      batchId,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "bundle failed" },
      { status: 500 }
    );
  }

  // Upload streams + sign URLs
  const streamsForResponse: Array<{
    key: string;
    printerLabel: string;
    pageCount: number;
    sheetCount: number;
    isDuplex: boolean;
    signedUrl: string;
  }> = [];
  const streamsForDb: Array<{
    key: string;
    printerLabel: string;
    pageCount: number;
    sheetCount: number;
    isDuplex: boolean;
    storagePath: string;
    signedUrl: string;
    instructions: string;
  }> = [];

  for (const stream of result.streams) {
    const path = `${shopId}/${batchId}/${stream.key}.pdf`;
    const up = await admin.storage
      .from(BUCKET_BATCHES)
      .upload(path, stream.pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (up.error) {
      return NextResponse.json(
        { success: false, error: `upload failed: ${up.error.message}` },
        { status: 500 }
      );
    }
    const signed = await admin.storage
      .from(BUCKET_BATCHES)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data) {
      return NextResponse.json(
        { success: false, error: `signed url failed: ${signed.error?.message ?? ""}` },
        { status: 500 }
      );
    }
    streamsForResponse.push({
      key: stream.key,
      printerLabel: stream.printerLabel,
      pageCount: stream.pageCount,
      sheetCount: stream.sheetCount,
      isDuplex: stream.isDuplex,
      signedUrl: signed.data.signedUrl,
    });
    streamsForDb.push({
      key: stream.key,
      printerLabel: stream.printerLabel,
      pageCount: stream.pageCount,
      sheetCount: stream.sheetCount,
      isDuplex: stream.isDuplex,
      storagePath: path,
      signedUrl: signed.data.signedUrl,
      instructions: stream.instructions,
    });
  }

  // Insert print_batches
  const { error: pbErr } = await admin.from("print_batches").insert({
    id: batchId,
    shop_id: shopId,
    merchant_id: merchantLink.id,
    job_ids: bundlerJobs.map((j) => j.id),
    manifest_json: result.manifestJson,
    streams_json: streamsForDb,
  });
  if (pbErr) {
    return NextResponse.json({ success: false, error: pbErr.message }, { status: 500 });
  }

  // Update jobs
  for (const job of bundlerJobs) {
    const bin = binAssignments[job.id] ?? 0;
    await admin
      .from("jobs")
      .update({ status: "BUNDLED", batch_id: batchId, bin_number: bin })
      .eq("id", job.id);
  }

  return NextResponse.json({
    success: true,
    data: {
      batchId,
      streams: streamsForResponse,
      binAssignments: result.binAssignments,
    },
  });
}
