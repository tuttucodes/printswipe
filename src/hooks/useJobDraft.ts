"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FileSettings, PaperType, PaperSize, ColorMode, Sides, Layout, Orientation } from "@/lib/types";

export interface JobDraftFile {
  id: string;
  filename: string;
  pageCount: number;
  size: number;
  storagePath: string | null;
  uploadProgress: number;
  settings: FileSettings;
}

export interface JobDraftState {
  draftId: string;
  shopId: string | null;
  shopName: string | null;
  slotIso: string | null;
  files: JobDraftFile[];
  notes: string;
  setShop: (id: string, name: string) => void;
  setSlot: (iso: string) => void;
  addFile: (file: JobDraftFile) => void;
  removeFile: (id: string) => void;
  updateFileProgress: (id: string, progress: number) => void;
  updateFileStoragePath: (id: string, path: string) => void;
  updateSettings: (id: string, partial: Partial<FileSettings>) => void;
  setNotes: (notes: string) => void;
  reset: () => void;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function defaultSettings(pageCount: number): FileSettings {
  return {
    paperType: "PLAIN" as PaperType,
    paperSize: "A4" as PaperSize,
    colorMode: "ALL_BW" as ColorMode,
    colorPagesSpec: null,
    sides: "SINGLE" as Sides,
    layout: 1 as Layout,
    copies: 1,
    pageRangeSpec: null,
    orientation: "AUTO" as Orientation,
    pageCount,
  };
}

export const useJobDraft = create<JobDraftState>()(
  persist(
    (set) => ({
      draftId: makeId(),
      shopId: null,
      shopName: null,
      slotIso: null,
      files: [],
      notes: "",
      setShop: (id, name) => set({ shopId: id, shopName: name }),
      setSlot: (iso) => set({ slotIso: iso }),
      addFile: (file) => set((s) => ({ files: [...s.files, file] })),
      removeFile: (id) => set((s) => ({ files: s.files.filter((f) => f.id !== id) })),
      updateFileProgress: (id, progress) =>
        set((s) => ({
          files: s.files.map((f) => (f.id === id ? { ...f, uploadProgress: progress } : f)),
        })),
      updateFileStoragePath: (id, path) =>
        set((s) => ({
          files: s.files.map((f) => (f.id === id ? { ...f, storagePath: path } : f)),
        })),
      updateSettings: (id, partial) =>
        set((s) => ({
          files: s.files.map((f) =>
            f.id === id ? { ...f, settings: { ...f.settings, ...partial } } : f
          ),
        })),
      setNotes: (notes) => set({ notes }),
      reset: () =>
        set({
          draftId: makeId(),
          shopId: null,
          shopName: null,
          slotIso: null,
          files: [],
          notes: "",
        }),
    }),
    {
      name: "printswipe-job-draft",
      storage: createJSONStorage(() => localStorage),
      // Don't persist non-serializable; everything here is JSON-safe (no File refs).
      partialize: (s) => ({
        draftId: s.draftId,
        shopId: s.shopId,
        shopName: s.shopName,
        slotIso: s.slotIso,
        files: s.files,
        notes: s.notes,
      }),
    }
  )
);

export { makeId };
