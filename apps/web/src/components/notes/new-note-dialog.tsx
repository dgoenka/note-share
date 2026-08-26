"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 sm:pt-16"
      role="dialog"
      aria-modal="true"
      aria-label="Create a note"
      onClick={onClose}
    >
      <div
        className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-amber-900/15 bg-[#fffcf5] shadow-2xl sm:h-[calc((100dvh-4rem)*0.7)] sm:max-h-[calc((100dvh-4rem)*0.7)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/80 px-4 py-3 sm:px-5 sm:py-3.5">
          <h2 className="font-display text-lg font-semibold text-stone-900 sm:text-xl">
            New note
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-lg p-0 text-stone-500 hover:bg-stone-200/60 hover:text-stone-900"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <NewNoteForm
            compact
            stayOnSuccess
            stickyActions
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
