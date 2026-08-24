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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ProfileView() {
  const { user, token, refresh } = useAuth();
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(40 * 1024 * 1024);
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
        if (!cancelled) {
          setNoteCount(me.noteCount ?? 0);
          setStorageUsed(me.storageBytesUsed ?? 0);
          setStorageLimit(me.storageBytesLimit ?? 40 * 1024 * 1024);
        }
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
          <div className="space-y-2 rounded-2xl border border-stone-200 bg-white/60 px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <dt className="font-semibold text-stone-600">Media storage</dt>
              <dd className="font-bold text-stone-900">
                {formatBytes(storageUsed)} / {formatBytes(storageLimit)}
              </dd>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all"
                style={{
                  width: `${Math.min(100, (storageUsed / Math.max(storageLimit, 1)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-stone-500">
              Images &amp; uploaded videos count toward this quota (embeds do
              not). Max 3 MB per file.
            </p>
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
