"use client";

import { useEffect } from "react";
import type { NoteDetail } from "@note-share/shared";
import { NewNoteForm } from "@/components/notes/new-note-form";
import { Button } from "@/components/ui/button";

export function NewNoteDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (note: NoteDetail) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create a note"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-amber-900/15 bg-[#fffcf5] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200/80 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
              Compose
            </p>
            <h2 className="font-display text-xl font-semibold text-stone-900 sm:text-2xl">
              Pin a new note
            </h2>
            <p className="mt-0.5 text-xs text-stone-500 sm:text-sm">
              Stays on the softboard — mint a share link without leaving.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <NewNoteForm
            compact
            stayOnSuccess
            onCancel={onClose}
            onCreated={(note) => {
              onCreated(note);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
