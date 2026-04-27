"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/client";
import { useJobDraft, defaultSettings, makeId, type JobDraftFile } from "@/hooks/useJobDraft";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CMYKBar } from "@/components/CMYKBar";
import { Wordmark } from "@/components/Wordmark";
import { cn } from "@/lib/utils";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PAGES_PER_PDF = 100;
const MAX_FILES = 15;
const MAX_TOTAL_PAGES = 500;

interface PreparedFile {
  bytes: Uint8Array;
  filename: string;
  pageCount: number;
}

async function fileToPdfBytes(file: File): Promise<PreparedFile> {
  const lower = file.name.toLowerCase();
  const isHeic = lower.endsWith(".heic") || lower.endsWith(".heif") || file.type.includes("heic") || file.type.includes("heif");

  if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.byteLength > MAX_FILE_SIZE) {
      throw new Error(`${file.name}: exceeds 50MB.`);
    }
    const doc = await PDFDocument.load(buf, { ignoreEncryption: false }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "Cannot read PDF";
      throw new Error(`${file.name}: ${msg}`);
    });
    if (doc.isEncrypted) {
      throw new Error(`${file.name}: Encrypted PDFs not supported.`);
    }
    const pageCount = doc.getPageCount();
    if (pageCount > MAX_PAGES_PER_PDF) {
      throw new Error(`${file.name}: ${pageCount} pages exceeds limit (${MAX_PAGES_PER_PDF}).`);
    }
    return { bytes: buf, filename: file.name, pageCount };
  }

  // Image: convert HEIC if needed, then wrap in single-page PDF
  let imageBlob: Blob = file;
  let outName = file.name;
  if (isHeic) {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    imageBlob = Array.isArray(converted) ? converted[0] : converted;
    outName = outName.replace(/\.(heic|heif)$/i, ".jpg");
  }
  if (imageBlob.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name}: image exceeds 50MB.`);
  }
  const buf = new Uint8Array(await imageBlob.arrayBuffer());
  const pdf = await PDFDocument.create();
  const isJpg =
    imageBlob.type === "image/jpeg" || outName.toLowerCase().endsWith(".jpg") || outName.toLowerCase().endsWith(".jpeg");
  const img = isJpg ? await pdf.embedJpg(buf) : await pdf.embedPng(buf);
  const page = pdf.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  const pdfBytes = await pdf.save();
  const finalName = outName.replace(/\.(jpg|jpeg|png)$/i, ".pdf");
  return { bytes: pdfBytes, filename: finalName, pageCount: 1 };
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shopId) router.push("/jobs/new/shop");
    else if (!slotIso) router.push("/jobs/new/slot");
  }, [shopId, slotIso, router]);

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
      for (const f of list) {
        let prepared: PreparedFile;
        try {
          prepared = await fileToPdfBytes(f);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to read file.");
          continue;
        }
        if (totalPages + prepared.pageCount > MAX_TOTAL_PAGES) {
          setError(`Total pages would exceed ${MAX_TOTAL_PAGES}.`);
          continue;
        }
        const id = makeId();
        const draftFile: JobDraftFile = {
          id,
          filename: prepared.filename,
          pageCount: prepared.pageCount,
          size: prepared.bytes.byteLength,
          storagePath: null,
          uploadProgress: 0,
          settings: defaultSettings(prepared.pageCount),
        };
        addFile(draftFile);
        const path = `${user.id}/${draftId}/${id}-${prepared.filename.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await sb.storage
          .from("job-files")
          .upload(path, prepared.bytes, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (upErr) {
          setError(`Upload failed for ${prepared.filename}: ${upErr.message}`);
          removeFile(id);
          continue;
        }
        updateFileStoragePath(id, path);
        updateFileProgress(id, 100);
      }
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
    <main className="min-h-[100dvh] pb-12">
      <CMYKBar height={4} />
      <header className="container py-6 flex items-center justify-between">
        <Wordmark className="h-5 w-auto text-ink" />
        <Link href="/jobs/new/slot" className="smallcaps text-ink/60 hover:text-ink">
          ← Back
        </Link>
      </header>

      <section className="container py-4">
        <span className="smallcaps text-ink/50">Step 3 of 5</span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">Upload files.</h1>
        <p className="text-sm text-ink/60 mt-2 font-mono">
          PDF, JPG, PNG, HEIC. Max {MAX_FILES} files / {MAX_TOTAL_PAGES} pages / 50MB each.
        </p>
      </section>

      <section className="container py-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            "hairline bg-paper p-10 text-center transition-colors",
            isDragging && "bg-ink/5"
          )}
        >
          <div className="smallcaps text-ink/50">Drop files here</div>
          <p className="text-sm text-ink/60 mt-2">or</p>
          <Button
            variant="primary"
            className="mt-4"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Processing…" : "Browse files"}
          </Button>
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
              <p className="text-accent font-mono text-sm">{error}</p>
            </CardBody>
          </Card>
        )}
      </section>

      {files.length > 0 && (
        <section className="container py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="smallcaps text-ink/70">Files ({files.length})</h2>
            <span className="font-mono text-xs text-ink/50 num">{totalPages} pages</span>
          </div>
          <ul className="grid gap-3">
            {files.map((f) => (
              <li key={f.id}>
                <Card>
                  <CardBody className="flex items-center gap-4">
                    <div className="w-10 h-12 hairline flex items-center justify-center font-mono text-[10px] text-ink/50 shrink-0">
                      PDF
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-bold truncate">{f.filename}</div>
                      <div className="font-mono text-xs text-ink/50 num mt-1">
                        {f.pageCount} pages · {formatBytes(f.size)}
                        {f.storagePath ? " · uploaded" : " · uploading…"}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(f.id)}
                      className="smallcaps text-ink/50 hover:text-accent"
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </CardBody>
                </Card>
              </li>
            ))}
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
    </main>
  );
}
