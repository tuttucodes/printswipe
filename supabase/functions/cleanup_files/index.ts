// Supabase Edge Function: cleanup_files
//
// Deletes expired uploaded files from Storage and marks the corresponding
// `job_files` rows as soft-deleted. Triggers per spec §15:
//
//   1. Job is COLLECTED and  collected_at + file_ttl_minutes_after_collected < now()
//   2. Job's slot_time + file_ttl_minutes_after_slot < now()
//
// TTLs read from `app_settings`:
//   - file_ttl_minutes_after_collected   (default 30)
//   - file_ttl_minutes_after_slot        (default 240)
//
// Schedule: every 15 minutes via Supabase pg_cron.
//
// Run locally:
//   supabase functions serve cleanup_files --env-file ./supabase/.env
// Deploy:
//   supabase functions deploy cleanup_files --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const STORAGE_BUCKET = "job-files";
const DEFAULT_TTL_AFTER_COLLECTED = 30;
const DEFAULT_TTL_AFTER_SLOT = 240;
const FILE_DELETE_BATCH = 100;

interface JobFileRow {
  id: string;
  job_id: string;
  storage_path: string;
}

interface JobRow {
  id: string;
  status: string;
  slot_time: string;
  collected_at: string | null;
  expires_at: string | null;
}

function envOrThrow(name: string): string {
  // deno-lint-ignore no-explicit-any
  const v = (Deno as any).env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function readMinutes(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

async function loadTtlSettings(client: ReturnType<typeof createClient>): Promise<{
  afterCollected: number;
  afterSlot: number;
}> {
  const { data, error } = await client
    .from("app_settings")
    .select("key, value_json")
    .in("key", ["file_ttl_minutes_after_collected", "file_ttl_minutes_after_slot"]);
  if (error) throw error;
  const map = new Map<string, unknown>(
    (data ?? []).map((row: { key: string; value_json: unknown }) => [row.key, row.value_json])
  );
  return {
    afterCollected: readMinutes(map.get("file_ttl_minutes_after_collected"), DEFAULT_TTL_AFTER_COLLECTED),
    afterSlot: readMinutes(map.get("file_ttl_minutes_after_slot"), DEFAULT_TTL_AFTER_SLOT),
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function findExpiredJobIds(
  client: ReturnType<typeof createClient>,
  afterCollectedMin: number,
  afterSlotMin: number,
): Promise<string[]> {
  const now = Date.now();
  const collectedCutoff = new Date(now - afterCollectedMin * 60_000).toISOString();
  const slotCutoff = new Date(now - afterSlotMin * 60_000).toISOString();

  // Two cheap selects, union locally — keeps queries index-friendly.
  const collectedQuery = client
    .from("jobs")
    .select("id, status, slot_time, collected_at, expires_at")
    .eq("status", "COLLECTED")
    .lt("collected_at", collectedCutoff);

  const slotQuery = client
    .from("jobs")
    .select("id, status, slot_time, collected_at, expires_at")
    .lt("slot_time", slotCutoff);

  const [a, b] = await Promise.all([collectedQuery, slotQuery]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;

  const ids = new Set<string>();
  for (const r of (a.data ?? []) as JobRow[]) ids.add(r.id);
  for (const r of (b.data ?? []) as JobRow[]) ids.add(r.id);
  return [...ids];
}

async function listLiveFiles(
  client: ReturnType<typeof createClient>,
  jobIds: string[],
): Promise<JobFileRow[]> {
  if (jobIds.length === 0) return [];
  const all: JobFileRow[] = [];
  for (const ids of chunk(jobIds, 200)) {
    const { data, error } = await client
      .from("job_files")
      .select("id, job_id, storage_path")
      .in("job_id", ids)
      .is("deleted_at", null);
    if (error) throw error;
    all.push(...((data ?? []) as JobFileRow[]));
  }
  return all;
}

async function deleteFromStorage(
  client: ReturnType<typeof createClient>,
  paths: string[],
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  for (const batch of chunk(paths, FILE_DELETE_BATCH)) {
    const { error } = await client.storage.from(STORAGE_BUCKET).remove(batch);
    if (error) {
      // Object may already be gone — count as failure but keep marking soft-deleted in DB
      // to prevent infinite retries.
      console.error("storage.remove error:", error.message);
      failed += batch.length;
    } else {
      deleted += batch.length;
    }
  }
  return { deleted, failed };
}

async function markRowsDeleted(
  client: ReturnType<typeof createClient>,
  fileIds: string[],
): Promise<number> {
  if (fileIds.length === 0) return 0;
  let updated = 0;
  for (const ids of chunk(fileIds, 200)) {
    const { error, count } = await client
      .from("job_files")
      .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
      .in("id", ids);
    if (error) throw error;
    updated += count ?? ids.length;
  }
  return updated;
}

async function setJobsExpired(
  client: ReturnType<typeof createClient>,
  jobIds: string[],
): Promise<number> {
  if (jobIds.length === 0) return 0;
  let updated = 0;
  for (const ids of chunk(jobIds, 200)) {
    const { error, count } = await client
      .from("jobs")
      .update({ expires_at: new Date().toISOString() }, { count: "exact" })
      .in("id", ids)
      .is("expires_at", null);
    if (error) throw error;
    updated += count ?? 0;
  }
  return updated;
}

async function run(): Promise<{
  jobsScanned: number;
  filesDeleted: number;
  filesFailed: number;
  rowsMarked: number;
  jobsExpired: number;
}> {
  const supabaseUrl = envOrThrow("SUPABASE_URL");
  const serviceKey = envOrThrow("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { afterCollected, afterSlot } = await loadTtlSettings(client);
  const jobIds = await findExpiredJobIds(client, afterCollected, afterSlot);
  if (jobIds.length === 0) {
    return { jobsScanned: 0, filesDeleted: 0, filesFailed: 0, rowsMarked: 0, jobsExpired: 0 };
  }

  const files = await listLiveFiles(client, jobIds);
  const paths = files.map((f) => f.storage_path);
  const fileIds = files.map((f) => f.id);

  const { deleted, failed } = await deleteFromStorage(client, paths);
  const rowsMarked = await markRowsDeleted(client, fileIds);
  const jobsExpired = await setJobsExpired(client, jobIds);

  return {
    jobsScanned: jobIds.length,
    filesDeleted: deleted,
    filesFailed: failed,
    rowsMarked,
    jobsExpired,
  };
}

// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve(async (_req: Request) => {
  try {
    const summary = await run();
    console.log("[cleanup_files]", JSON.stringify(summary));
    return new Response(JSON.stringify({ success: true, data: summary }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[cleanup_files] failed:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
