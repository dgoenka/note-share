"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/loading-block";
import { formatDateTime } from "@/lib/utils";

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileView />
    </RequireAuth>
  );
}

function ProfileView() {
  const { user, token, refresh } = useAuth();
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await refresh();
        const me = await api.me(token);
        if (!cancelled) setNoteCount(me.noteCount ?? 0);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load profile"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  if (!user) return null;

  if (loading) {
    return <LoadingBlock label="Loading profile…" />;
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          Account
        </p>
        <CardTitle className="text-2xl sm:text-3xl">{user.name}</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="destructive">{error}</Alert>}

        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/60 px-4 py-3">
            <dt className="font-semibold text-stone-600">Member since</dt>
            <dd className="text-stone-900">{formatDateTime(user.createdAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/60 px-4 py-3">
            <dt className="font-semibold text-stone-600">Notes owned</dt>
            <dd className="text-lg font-bold text-stone-900">
              {noteCount ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/60 px-4 py-3">
            <dt className="font-semibold text-stone-600">User id</dt>
            <dd className="max-w-[55%] truncate font-mono text-xs text-stone-500">
              {user.id}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[#faf6ef] sm:w-auto"
          >
            Back to board
          </Link>
          <Link
            href="/notes/new"
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-stone-300 bg-white/80 px-4 text-sm font-semibold text-stone-900 sm:w-auto"
          >
            New note
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
