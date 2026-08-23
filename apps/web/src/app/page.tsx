"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock3,
  Eye,
  KeyRound,
  Link2,
  Lock,
  Plus,
  Sparkles,
  Timer,
} from "lucide-react";
import type { NoteDetail } from "@note-share/shared";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock, LoadingOverlay } from "@/components/ui/loading-block";
import { formatDateTime } from "@/lib/utils";

function statusBadge(note: NoteDetail) {
  if (note.isRevoked) return <Badge variant="destructive">Revoked</Badge>;
  if (note.isUsed) return <Badge variant="warning">Used</Badge>;
  if (note.isExpired) return <Badge variant="warning">Expired</Badge>;
  return <Badge variant="success">Live</Badge>;
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
    return <LoadingBlock label="Warming up…" />;
  }

  if (!user) {
    return (
      <div className="space-y-8">
        <section className="animate-fade-up relative overflow-hidden rounded-[2rem] border border-violet-200/60 bg-white/60 p-8 shadow-[var(--shadow)] backdrop-blur-xl sm:p-10">
          <div className="mesh-orb -right-10 -top-10 h-40 w-40 bg-fuchsia-300/60" />
          <div className="mesh-orb bottom-0 left-10 h-28 w-28 bg-cyan-200/50" />
          <div className="relative space-y-5">
            <Badge className="bg-violet-100 text-violet-800">
              <Sparkles className="mr-1 h-3 w-3" />
              secrets with an expiry date
            </Badge>
            <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
              Share a note.
              <br />
              <span className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-rose-500 bg-clip-text text-transparent">
                Then let it vanish.
              </span>
            </h1>
            <p className="max-w-xl text-base text-[var(--muted)] sm:text-lg">
              Write something important, generate a secure link, and choose
              one-time or timed access — with an optional access key for extra
              spice.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => router.push("/register")}>
                Start sharing
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => router.push("/login")}
              >
                I have an account
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Timer,
              title: "One-time links",
              body: "Burns after the first successful open.",
              delay: "stagger-1",
            },
            {
              icon: Clock3,
              title: "Timed expiry",
              body: "Pick a deadline — the link retires itself.",
              delay: "stagger-2",
            },
            {
              icon: KeyRound,
              title: "Access keys",
              body: "Server-made keys, shown once, bcrypt-hashed.",
              delay: "stagger-3",
            },
          ].map((item) => (
            <Card
              key={item.title}
              className={`animate-fade-up ${item.delay} p-5 transition hover:-translate-y-1 hover:shadow-lg`}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-500">
            Notebook
          </p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            Your notes
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Signed in as {user.email}
          </p>
        </div>
        <Button onClick={() => router.push("/notes/new")} disabled={fetching}>
          <Plus className="h-4 w-4" />
          New note
        </Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <LoadingOverlay active={fetching} label="Fetching your secrets…">
        {!fetching && notes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="animate-floaty flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-100 text-violet-700">
                <Link2 className="h-6 w-6" />
              </div>
              <p className="font-display text-xl">Empty desk (for now)</p>
              <p className="max-w-sm text-sm text-[var(--muted)]">
                Create a note and you&apos;ll get a share link instantly —
                public or locked.
              </p>
              <Button onClick={() => router.push("/notes/new")}>
                Write the first one
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="min-h-[8rem] space-y-3">
            {notes.map((note, idx) => (
              <li
                key={note.id}
                className={`animate-fade-up stagger-${Math.min(idx + 1, 4)}`}
              >
                <Link
                  href={`/notes/${note.id}`}
                  className={fetching ? "pointer-events-none" : undefined}
                  tabIndex={fetching ? -1 : undefined}
                  aria-disabled={fetching || undefined}
                >
                  <Card className="transition hover:-translate-y-0.5 hover:border-violet-300/70 hover:shadow-lg">
                    <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <p className="truncate font-display text-lg font-semibold">
                          {note.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
                            {note.shareType === "ONE_TIME" ? (
                              <Timer className="h-3 w-3" />
                            ) : (
                              <Clock3 className="h-3 w-3" />
                            )}
                            {note.shareType === "ONE_TIME"
                              ? "One-time"
                              : "Time-based"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 px-2 py-0.5 font-semibold text-fuchsia-700">
                            {note.accessType === "PUBLIC" ? (
                              <Eye className="h-3 w-3" />
                            ) : (
                              <Lock className="h-3 w-3" />
                            )}
                            {note.accessType === "PUBLIC"
                              ? "Public"
                              : "Password"}
                          </span>
                          <span>
                            {note.viewCount} view
                            {note.viewCount === 1 ? "" : "s"}
                          </span>
                          <span>· {formatDateTime(note.createdAt)}</span>
                        </div>
                      </div>
                      <div className="shrink-0">{statusBadge(note)}</div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </LoadingOverlay>
    </div>
  );
}
