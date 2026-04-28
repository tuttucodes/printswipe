"use client";

import { createClient } from "./supabase/client";

export interface UploadOpts {
  bucket: string;
  path: string;
  bytes: Uint8Array | Blob;
  contentType?: string;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

/**
 * Upload to Supabase Storage with progress + cancellation.
 * Uses signed-upload-url + raw XHR so we get real progress events.
 * Falls back to plain `upload()` if the signed-URL API fails (older buckets).
 */
export async function uploadWithProgress(opts: UploadOpts): Promise<{ error: string | null }> {
  const sb = createClient();

  // 1. Get a one-shot signed upload URL
  const { data: signed, error: sErr } = await sb.storage
    .from(opts.bucket)
    .createSignedUploadUrl(opts.path);

  if (sErr || !signed) {
    // Fallback: plain upload (no progress events)
    const blob = opts.bytes instanceof Blob ? opts.bytes : new Blob([opts.bytes], { type: opts.contentType ?? "application/octet-stream" });
    const { error } = await sb.storage
      .from(opts.bucket)
      .upload(opts.path, blob, { contentType: opts.contentType, upsert: false });
    if (error) return { error: error.message };
    opts.onProgress?.(100);
    return { error: null };
  }

  return uploadToSignedUrlXhr({
    url: signed.signedUrl,
    token: signed.token,
    path: signed.path,
    bytes: opts.bytes,
    contentType: opts.contentType,
    onProgress: opts.onProgress,
    signal: opts.signal,
  });
}

interface SignedXhrOpts {
  url: string;
  token: string;
  path: string;
  bytes: Uint8Array | Blob;
  contentType?: string;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

function uploadToSignedUrlXhr(opts: SignedXhrOpts): Promise<{ error: string | null }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", opts.url, true);
    if (opts.contentType) xhr.setRequestHeader("Content-Type", opts.contentType);
    xhr.setRequestHeader("x-upsert", "false");

    if (opts.signal) {
      const onAbort = () => xhr.abort();
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.(100);
        resolve({ error: null });
      } else {
        resolve({ error: `Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}` });
      }
    };
    xhr.onerror = () => resolve({ error: "Network error during upload" });
    xhr.onabort = () => resolve({ error: "Upload cancelled" });

    const body = opts.bytes instanceof Blob ? opts.bytes : new Blob([opts.bytes], { type: opts.contentType });
    xhr.send(body);
  });
}

/** Run async tasks with bounded concurrency. Returns results in input order. */
export async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  return results;
}
