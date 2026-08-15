"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NoteDetail } from "@note-share/shared";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/utils";

function statusBadge(note: NoteDetail) {
  if (note.isRevoked) return <Badge variant="destructive">Revoked</Badge>;
  if (note.isUsed) return <Badge variant="warning">Used (one-time)</Badge>;
  if (note.isExpired) return <Badge variant="warning">Expired</Badge>;
  return <Badge variant="success">Active</Badge>;
}

export default function HomePage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<NoteDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !token) return;

    let cancelled = false;
    (async () => {
      setFetching(true);
      setError(null);
      try {
        const res = await api.listNotes(token);
        if (!cancelled) setNotes(res.notes);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load notes"
          );
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, token, loading]);

  if (loading) {
    return (
      <p className="text-center text-sm text-slate-500">Loading session…</p>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Secure note sharing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              Create a note, generate a secure share link, and control access
              with one-time or time-based expiry — optionally protected by a
              one-time access key.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => router.push("/register")}>
                Get started
              </Button>
              <Button variant="outline" onClick={() => router.push("/login")}>
                Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your notes</h1>
          <p className="text-sm text-slate-500">
            Signed in as {user.email}
          </p>
        </div>
        <Button onClick={() => router.push("/notes/new")}>New note</Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {fetching && (
        <p className="text-sm text-slate-500">Loading notes…</p>
      )}

      {!fetching && notes.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            No notes yet. Create one to generate a share link.
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {notes.map((note) => (
          <li key={note.id}>
            <Link href={`/notes/${note.id}`}>
              <Card className="transition hover:border-slate-300 hover:shadow">
                <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{note.title}</p>
                    <p className="text-xs text-slate-500">
                      {note.shareType === "ONE_TIME" ? "One-time" : "Time-based"}
                      {" · "}
                      {note.accessType === "PUBLIC" ? "Public" : "Password"}
                      {" · "}
                      {note.viewCount} view{note.viewCount === 1 ? "" : "s"}
                      {" · "}
                      {formatDateTime(note.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0">{statusBadge(note)}</div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
