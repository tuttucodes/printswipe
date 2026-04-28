"use client";

/**
 * Compress an image Blob client-side via canvas re-encoding.
 * Default targets ~300 DPI A4 (2480x3508) at JPEG quality 0.85.
 * Saves 60–90% bandwidth on phone-camera shots.
 */
export interface CompressOpts {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0..1
  mimeType?: "image/jpeg" | "image/png";
}

const DEFAULTS: Required<CompressOpts> = {
  maxWidth: 2480,
  maxHeight: 3508,
  quality: 0.85,
  mimeType: "image/jpeg",
};

export async function compressImage(blob: Blob, override: CompressOpts = {}): Promise<Blob> {
  const opts = { ...DEFAULTS, ...override };
  const dataUrl = await blobToDataUrl(blob);
  const img = await loadImage(dataUrl);

  const { w, h } = fit(img.width, img.height, opts.maxWidth, opts.maxHeight);
  if (w >= img.width && h >= img.height && blob.type === opts.mimeType && blob.size < 1.5 * 1024 * 1024) {
    return blob;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => {
        if (out) resolve(out);
        else reject(new Error("Canvas toBlob returned null"));
      },
      opts.mimeType,
      opts.quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("FileReader error"));
    r.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function fit(srcW: number, srcH: number, maxW: number, maxH: number): { w: number; h: number } {
  const ratio = Math.min(maxW / srcW, maxH / srcH, 1);
  return { w: Math.round(srcW * ratio), h: Math.round(srcH * ratio) };
}

/** Detect slow connection (2G/3G/save-data). Returns label or null. */
export function slowConnectionLabel(): string | null {
  if (typeof navigator === "undefined") return null;
  const conn = (navigator as unknown as {
    connection?: { effectiveType?: string; saveData?: boolean; downlink?: number };
  }).connection;
  if (!conn) return null;
  if (conn.saveData) return "Data Saver mode is on";
  const t = conn.effectiveType;
  if (t === "slow-2g" || t === "2g") return `Slow connection (${t.toUpperCase()})`;
  if (t === "3g" && (conn.downlink ?? 0) < 1.5) return "Slow connection (3G)";
  return null;
}
