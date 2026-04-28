"use client";
import { StepIndicator } from "@/components/StepIndicator";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/client";
import { useJobDraft, defaultSettings, makeId, type JobDraftFile } from "@/hooks/useJobDraft";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { Footer } from "@/components/Footer";
import { compressImage, slowConnectionLabel } from "@/lib/imageCompress";
import { uploadWithProgress, withConcurrency } from "@/lib/upload";
import { cn } from "@/lib/utils";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_PAGES_PER_PDF = 100;
const MAX_FILES = 15;
const MAX_TOTAL_PAGES = 500;
const PARALLEL = 3;

interface PreparedFile {
  bytes: Uint8Array;
  filename: string;
  pageCount: number;
  originalSize: number;
  compressedSize: number;
}

async function prepareFile(file: File): Promise<PreparedFile> {
  const lower = file.name.toLowerCase();
  const isHeic = lower.endsWith(".heic") || lower.endsWith(".heif") || file.type.includes("heic") || file.type.includes("heif");
  const originalSize = file.size;

  // PDF — re-save with object streams to shrink + strip metadata
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.byteLength > MAX_FILE_SIZE) throw new Error(`${file.name}: exceeds 50MB.`);
    const doc = await PDFDocument.load(buf, { ignoreEncryption: false }).catch((e: unknown) => {
      throw new Error(`${file.name}: ${e instanceof Error ? e.message : "Cannot read PDF"}`);
    });
    if (doc.isEncrypted) throw new Error(`${file.name}: Encrypted PDFs not supported.`);
    const pageCount = doc.getPageCount();
    if (pageCount > MAX_PAGES_PER_PDF) {
      throw new Error(`${file.name}: ${pageCount} pages exceeds limit (${MAX_PAGES_PER_PDF}).`);
    }
    doc.setTitle(file.name);
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setProducer("Printswipe");
    doc.setCreator("Printswipe");
    const optimized = await doc.save({ useObjectStreams: true });
    return {
      bytes: optimized,
      filename: file.name,
      pageCount,
      originalSize,
      compressedSize: optimized.byteLength,
    };
  }

  // Image — convert HEIC, compress, embed in 1-page PDF
  let imageBlob: Blob = file;
  let outName = file.name;
  if (isHeic) {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    imageBlob = Array.isArray(converted) ? converted[0] : converted;
    outName = outName.replace(/\.(heic|heif)$/i, ".jpg");
  }

  imageBlob = await compressImage(imageBlob, { maxWidth: 2480, maxHeight: 3508, quality: 0.85 });

  if (imageBlob.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name}: image still exceeds 50MB after compression.`);
  }
  const buf = new Uint8Array(await imageBlob.arrayBuffer());
  const pdf = await PDFDocument.create();
  pdf.setProducer("Printswipe");
  pdf.setCreator("Printswipe");
  const isJpg = imageBlob.type === "image/jpeg";
  const img = isJpg ? await pdf.embedJpg(buf) : await pdf.embedPng(buf);
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  const pdfBytes = await pdf.save({ useObjectStreams: true });
  const finalName = outName.replace(/\.(jpg|jpeg|png)$/i, ".pdf");
  return {
    bytes: pdfBytes,
    filename: finalName,
    pageCount: 1,
    originalSize,
    compressedSize: pdfBytes.byteLength,
  };
}

export default function NewJobFilesPage() {
  const router = useRouter();
  const draftId = useJobDraft((s) => s.draftId);
  const shopId = useJobDraft((s) => s.shopId);
  const slotIso = useJobDraft((s) => s.slotIso);
  const files = useJobDraft((s) => s.files);
  const addFile = useJobDraft((s) => s.addFile);
  const removeFile = useJobDraft((s) => s.removeFile);
  const updateFileProgress = useJobDraft((s) => s.updateFileProgress);
  const updateFileStoragePath = useJobDraft((s) => s.updateFileStoragePath);

  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slowNet, setSlowNet] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shopId) router.push("/jobs/new/shop");
    else if (!slotIso) router.push("/jobs/new/slot");
  }, [shopId, slotIso, router]);

  useEffect(() => {
    setSlowNet(slowConnectionLabel());
  }, []);

  const totalPages = files.reduce((s, f) => s + f.pageCount, 0);

  const onChosen = async (chosen: FileList | File[]) => {
    setError(null);
    const list = Array.from(chosen);
    if (files.length + list.length > MAX_FILES) {
      setError(`Cannot exceed ${MAX_FILES} files per job.`);
      return;
    }
    setBusy(true);
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        setError("Not signed in.");
        return;
      }

      const stubs = list.map((f) => ({ id: makeId(), file: f }));

      // Add stubs immediately so the user sees rows + progress bars
      stubs.forEach(({ id, file }) => {
        addFile({
          id,
          filename: file.name,
          pageCount: 0,
          size: file.size,
          storagePath: null,
          uploadProgress: 0,
          settings: defaultSettings(1),
        });
      });

      let runningTotal = totalPages;
      const errs: string[] = [];

      await withConcurrency(stubs, PARALLEL, async ({ id, file }) => {
        try {
          const prepared = await prepareFile(file);
          if (runningTotal + prepared.pageCount > MAX_TOTAL_PAGES) {
            errs.push(`${file.name}: total pages would exceed ${MAX_TOTAL_PAGES}.`);
            removeFile(id);
            return;
          }
          runningTotal += prepared.pageCount;

          updateFileProgress(id, 5);

          const path = `${user.id}/${draftId}/${id}-${prepared.filename.replace(/[^\w.\-]/g, "_")}`;
          const { error: upErr } = await uploadWithProgress({
            bucket: "job-files",
            path,
            bytes: prepared.bytes,
            contentType: "application/pdf",
            onProgress: (pct) => updateFileProgress(id, pct),
          });
          if (upErr) {
            errs.push(`${prepared.filename}: ${upErr}`);
            removeFile(id);
            return;
          }

          // Replace the stub with the real, parsed entry (atomic via remove+add)
          removeFile(id);
          const draftFile: JobDraftFile = {
            id,
            filename: prepared.filename,
            pageCount: prepared.pageCount,
            size: prepared.compressedSize,
            storagePath: path,
            uploadProgress: 100,
            settings: defaultSettings(prepared.pageCount),
          };
          addFile(draftFile);
          updateFileStoragePath(id, path);
        } catch (e) {
          errs.push(e instanceof Error ? e.message : `${file.name}: failed.`);
          removeFile(id);
        }
      });

      if (errs.length) setError(errs.join(" · "));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) onChosen(e.dataTransfer.files);
  };

  const formatBytes = (n: number): string => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  const allUploaded = files.length > 0 && files.every((f) => f.storagePath !== null);

  return (
    <AppShell>
      <section className="container py-3">
        <Link href="/jobs/new/slot" className="smallcaps text-ink/60 hover:text-ink">
          ← Back
        </Link>
      </section>

      <section className="container py-2">
        <StepIndicator current={3} />
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-3">Add your files.</h1>
        <p className="text-sm text-ink/60 mt-2 font-mono">
          PDF, JPG, PNG, HEIC. Max {MAX_FILES} files / {MAX_TOTAL_PAGES} pages / 50MB each.
        </p>
      </section>

      {slowNet && (
        <section className="container py-2">
          <div className="hairline border-status-bundled bg-paper p-3 text-sm">
            <div className="smallcaps text-status-bundled mb-1">Heads up</div>
            <p className="text-ink/80">
              {slowNet}. We compress images before upload to save data, but this can still take a
              while. Stay on this screen until uploads finish.
            </p>
          </div>
        </section>
      )}

      <section className="container py-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            "hairline bg-paper p-8 sm:p-10 text-center transition-colors",
            isDragging && "bg-ink/5"
          )}
        >
          <div className="smallcaps text-ink/60">Drop files here</div>
          <p className="text-sm text-ink/60 mt-2">or</p>
          <Button
            variant="primary"
            className="mt-4"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Processing…" : "Browse files"}
          </Button>
          <p className="text-xs text-ink/60 mt-3 font-mono">
            Up to {PARALLEL} files in parallel · images auto-compressed
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => e.target.files && onChosen(e.target.files)}
          />
        </div>

        {error && (
          <Card className="mt-4">
            <CardBody>
              <p className="text-status-failed font-mono text-sm whitespace-pre-line">{error}</p>
            </CardBody>
          </Card>
        )}
      </section>

      {files.length > 0 && (
        <section className="container py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="smallcaps text-ink/70">Files ({files.length})</h2>
            <span className="font-mono text-xs text-ink/60 num">{totalPages} pages</span>
          </div>
          <ul className="grid gap-3">
            {files.map((f) => {
              const pct = f.uploadProgress ?? 0;
              const done = f.storagePath !== null;
              return (
                <li key={f.id}>
                  <Card>
                    <CardBody className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-12 hairline flex items-center justify-center font-mono text-[10px] text-ink/60 shrink-0">
                          PDF
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm font-bold truncate">{f.filename}</div>
                          <div className="font-mono text-xs text-ink/60 num mt-1">
                            {f.pageCount > 0 ? `${f.pageCount} pages · ` : ""}
                            {formatBytes(f.size)}
                            {done ? " · uploaded" : pct > 0 ? ` · ${pct}%` : " · preparing…"}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(f.id)}
                          className="smallcaps text-ink/60 hover:text-status-failed transition-colors"
                          aria-label={`Remove ${f.filename}`}
                        >
                          Remove
                        </button>
                      </div>
                      {!done && (
                        <div className="h-1 bg-ink/10 overflow-hidden" aria-label="Upload progress">
                          <div
                            className="h-full bg-accent transition-[width]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="container py-6">
        <Button
          variant="accent"
          size="lg"
          className="w-full md:w-auto"
          disabled={!allUploaded || busy}
          onClick={() => router.push("/jobs/new/configure")}
        >
          Continue
        </Button>
      </section>

      <Footer />
    </AppShell>
  );
}
