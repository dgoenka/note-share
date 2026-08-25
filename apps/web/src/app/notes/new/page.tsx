"use client";

import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { NewNoteForm } from "@/components/notes/new-note-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NewNotePage() {
  return (
    <RequireAuth>
      <NewNotePageInner />
    </RequireAuth>
  );
}

function NewNotePageInner() {
  const router = useRouter();

  return (
    <Card className="animate-fade-up overflow-hidden">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          Compose
        </p>
        <CardTitle className="text-2xl sm:text-3xl">Create a note</CardTitle>
        <CardDescription>
          Mint a secure share link. Password notes get a one-time key; restricted
          notes only open for allowlisted accounts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewNoteForm
          onCancel={() => router.push("/")}
          onCreated={(note) => {
            const q =
              note.accessKey != null
                ? `?accessKey=${encodeURIComponent(note.accessKey)}`
                : "";
            router.replace(`/notes/${note.id}${q}`);
          }}
        />
      </CardContent>
    </Card>
  );
}
