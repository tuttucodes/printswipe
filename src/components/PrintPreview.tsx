"use client";
import { useEffect } from "react";
import type { FileSettings } from "@/lib/types";
import { tryParseRangeSpec } from "@/lib/validation";

interface Props {
  open: boolean;
  filename: string;
  settings: FileSettings;
  onClose: () => void;
}

const PAPER_DIM_MM: Record<"A4" | "A3" | "A2", { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  A2: { w: 420, h: 594 },
};

export function PrintPreview({ open, filename, settings, onClose }: Props) {
  // Escape closes
  useEffect(() => {
    if (!open) return;
    function k(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const isLandscape = settings.orientation === "LANDSCAPE";
  const dims = PAPER_DIM_MM[settings.paperSize as "A4" | "A3" | "A2"];
  const sheetW = isLandscape ? dims.h : dims.w;
  const sheetH = isLandscape ? dims.w : dims.h;
  const aspect = sheetH / sheetW;

  const rangeOk = settings.pageRangeSpec
    ? tryParseRangeSpec(settings.pageRangeSpec, settings.pageCount)
    : { ok: true as const, pages: Array.from({ length: settings.pageCount }, (_, i) => i + 1) };
  const effectivePages = rangeOk.ok ? rangeOk.pages.length : settings.pageCount;
  const sheetCount =
    Math.ceil(effectivePages / settings.layout) *
    settings.copies *
    (settings.sides === "DOUBLE" ? 0.5 : 1);

  const isColor = settings.colorMode !== "ALL_BW";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Print preview for ${filename}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper hairline max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="hairline-b p-4 flex items-start justify-between">
          <div className="min-w-0">
            <div className="smallcaps text-ink/60">Print preview</div>
            <div className="font-mono text-sm mt-1 truncate">{filename}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="min-h-11 min-w-11 -mr-2 -mt-2 flex items-center justify-center text-ink/60 hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Sheet visualization */}
        <div className="p-6 flex justify-center">
          <div
            className="hairline bg-white relative shadow-sm"
            style={{
              width: isLandscape ? "260px" : `${260 / aspect / (sheetW / sheetH)}px`,
              maxWidth: "260px",
              aspectRatio: `${sheetW}/${sheetH}`,
            }}
            aria-label="Sample sheet"
          >
            <NUpGrid layout={settings.layout} isColor={isColor} mixed={settings.colorMode === "MIXED"} />
          </div>
        </div>

        {/* Settings list */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Cell label="Paper" value={`${settings.paperType === "POSTER_GLOSSY" ? "Glossy " : "Plain "}${settings.paperSize}`} />
          <Cell label="Orientation" value={settings.orientation === "PORTRAIT" ? "Portrait" : "Landscape"} />
          <Cell label="Color" value={
            settings.colorMode === "ALL_COLOR" ? "All color" :
            settings.colorMode === "ALL_BW" ? "All B&W" :
            "Mixed"
          } />
          <Cell label="Sides" value={settings.sides === "DOUBLE" ? "Double-sided" : "Single-sided"} />
          <Cell label="Layout" value={`${settings.layout}-up`} />
          <Cell label="Copies" value={String(settings.copies)} />
          <Cell label="Range" value={settings.pageRangeSpec || `All ${settings.pageCount}`} />
          <Cell label="Source pages" value={String(settings.pageCount)} />
        </div>

        <div className="hairline-t px-5 py-4 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Effective pages" value={String(effectivePages * settings.copies)} />
          <Stat label="Sheets needed" value={String(Math.ceil(sheetCount))} accent />
        </div>
      </div>
    </div>
  );
}

function NUpGrid({
  layout,
  isColor,
  mixed,
}: {
  layout: 1 | 2 | 4 | 6;
  isColor: boolean;
  mixed: boolean;
}) {
  const cells: Array<{ x: number; y: number; w: number; h: number; pageNum: number }> = [];
  if (layout === 1) cells.push({ x: 0, y: 0, w: 1, h: 1, pageNum: 1 });
  if (layout === 2) {
    cells.push({ x: 0, y: 0,   w: 1, h: 0.5, pageNum: 1 });
    cells.push({ x: 0, y: 0.5, w: 1, h: 0.5, pageNum: 2 });
  }
  if (layout === 4) {
    cells.push({ x: 0, y: 0, w: 0.5, h: 0.5, pageNum: 1 });
    cells.push({ x: 0.5, y: 0, w: 0.5, h: 0.5, pageNum: 2 });
    cells.push({ x: 0, y: 0.5, w: 0.5, h: 0.5, pageNum: 3 });
    cells.push({ x: 0.5, y: 0.5, w: 0.5, h: 0.5, pageNum: 4 });
  }
  if (layout === 6) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        cells.push({ x: c * 0.5, y: r / 3, w: 0.5, h: 1 / 3, pageNum: r * 2 + c + 1 });
      }
    }
  }

  return (
    <div className="absolute inset-1.5">
      {cells.map((c, i) => {
        const cellColor = mixed && i % 2 === 0 ? "#EF3340" : isColor ? "#0050FF" : "#0A0A0A";
        return (
          <div
            key={i}
            className="absolute border border-dashed border-ink/30 flex items-center justify-center text-[8px] font-mono text-ink/50"
            style={{
              left: `${c.x * 100}%`,
              top: `${c.y * 100}%`,
              width: `${c.w * 100}%`,
              height: `${c.h * 100}%`,
              padding: "2px",
            }}
          >
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-1"
              style={{ background: `${cellColor}10` }}
            >
              <div
                className="w-3 h-3 rounded-sm opacity-60"
                style={{ background: cellColor }}
                aria-hidden="true"
              />
              <span className="num">{c.pageNum}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="smallcaps text-ink/60">{label}</div>
      <div className="font-mono mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="smallcaps text-ink/60">{label}</div>
      <div className={`font-mono font-bold text-2xl num mt-0.5 ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
