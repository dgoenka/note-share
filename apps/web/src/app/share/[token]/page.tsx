"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { KeyRound, Sparkles, Users } from "lucide-react";
import type { ShareStatus, SharedNoteView } from "@note-share/shared";
import { unlockShareSchema } from "@note-share/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoadingBlock, LoadingOverlay } from "@/components/ui/loading-block";
import { formatDateTime } from "@/lib/utils";

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const shareToken = params.token;
  const { user, token: authToken, loading: authLoading } = useAuth();

  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [view, setView] = useState<SharedNoteView | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!shareToken) return;
    setLoading(true);
    setError(null);
    try {
      const s = await api.shareStatus(shareToken, authToken);
      setStatus(s);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load share link"
      );
    } finally {
      setLoading(false);
    }
  }, [shareToken, authToken]);

  useEffect(() => {
    if (authLoading) return;
    void loadStatus();
  }, [loadStatus, authLoading]);

  // Auto-open PUBLIC (and RESTRICTED when already allowed)
  useEffect(() => {
    if (authLoading || !status || !shareToken || view) return;
    if (!status.valid) return;
    if (status.requiresPassword) return;
    if (status.requiresAuth) {
      if (!authToken) return;
      if (status.viewerAllowed !== true) return;
    }

    let cancelled = false;
    (async () => {
      setOpening(true);
      setError(null);
      try {
        const opened = await api.openShare(shareToken, authToken);
        if (!cancelled) setView(opened);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to open share"
          );
          void loadStatus();
        }
      } finally {
        if (!cancelled) setOpening(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, shareToken, view, authToken, authLoading, loadStatus]);

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    if (!shareToken || opening) return;
    setError(null);

    const parsed = unlockShareSchema.safeParse({ password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid password");
      return;
    }

    setOpening(true);
    try {
      const opened = await api.unlockShare(shareToken, parsed.data.password);
      setView(opened);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to unlock share"
      );
      if (err instanceof ApiError && err.status === 410) {
        void loadStatus();
      }
      setOpening(false);
    }
  }

  async function openRestricted() {
    if (!shareToken || !authToken || opening) return;
    setOpening(true);
    setError(null);
    try {
      const opened = await api.openShare(shareToken, authToken);
      setView(opened);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open share");
      void loadStatus();
      setOpening(false);
    }
  }

  if (authLoading || loading) {
    return <LoadingBlock label="Peeking at this share link…" />;
  }

  if (view) {
    return (
      <Card className="animate-fade-up overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]" />
        <CardHeader>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
            Shared note
          </p>
          <CardTitle className="break-words text-2xl sm:text-3xl">
            {view.title}
          </CardTitle>
          <CardDescription>
            {view.shareType === "ONE_TIME" ? "One-time" : "Time-based"}
            {" · "}
            {view.accessType === "PUBLIC"
              ? "Public"
              : view.accessType === "PASSWORD"
                ? "Password-protected"
                : "Email allowlist"}
            {view.expiresAt
              ? ` · Expires ${formatDateTime(view.expiresAt)}`
              : ""}
            {" · "}
            Views: {view.viewCount}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap rounded-2xl border border-stone-200 bg-gradient-to-br from-white to-violet-50/60 p-5 text-sm leading-relaxed shadow-inner">
            {view.content}
          </div>
          {view.shareType === "ONE_TIME" && (
            <Alert variant="warning" className="mt-4">
              Boom — this was a one-time link. It&apos;s consumed and can&apos;t
              be opened again.
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!status?.valid) {
    const reason = status?.reason || "NOT_FOUND";
    const messages: Record<string, string> = {
      NOT_FOUND: "This share link is invalid or does not exist.",
      REVOKED: "This share link has been revoked by its owner.",
      EXPIRED: "This share link has expired.",
      ALREADY_USED: "This one-time link has already been used.",
    };
    return (
      <Card className="animate-fade-up">
        <CardHeader>
          <CardTitle className="text-2xl sm:text-3xl">Link unavailable</CardTitle>
          <CardDescription>
            {messages[reason] || "This share link cannot be opened."}
          </CardDescription>
        </CardHeader>
        {status?.title && (
          <CardContent>
            <p className="text-sm text-[var(--muted)]">Note: {status.title}</p>
          </CardContent>
        )}
      </Card>
    );
  }

  if (status.requiresPassword) {
    return (
      <Card className="animate-fade-up mx-auto max-w-md overflow-hidden">
        <div className="flex items-center gap-3 border-b border-stone-200 bg-gradient-to-r from-[var(--primary-soft)] to-[#fde8d8] px-6 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-white shadow-md">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
              Locked
            </p>
            <p className="font-display text-lg font-semibold">
              {status.title || "Protected note"}
            </p>
          </div>
        </div>
        <CardHeader>
          <CardDescription>
            Enter the access key to unlock this note.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingOverlay active={opening} label="Unlocking…">
            <form
              onSubmit={onUnlock}
              className="space-y-4"
              aria-busy={opening}
            >
              {error && <Alert variant="destructive">{error}</Alert>}
              <fieldset disabled={opening} className="space-y-4 border-0 p-0">
                <div className="space-y-2">
                  <Label htmlFor="password">Access key / password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    placeholder="Paste the key you were given"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={opening}
                >
                  {opening ? "Unlocking…" : "Unlock"}
                </Button>
              </fieldset>
            </form>
          </LoadingOverlay>
        </CardContent>
      </Card>
    );
  }

  if (status.requiresAuth) {
    return (
      <Card className="animate-fade-up mx-auto max-w-md overflow-hidden">
        <div className="flex items-center gap-3 border-b border-stone-200 bg-gradient-to-r from-[var(--primary-soft)] to-[#efe6d8] px-6 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)] text-[#faf6ef] shadow-md">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
              Restricted
            </p>
            <p className="truncate font-display text-lg font-semibold">
              {status.title || "Allowlisted note"}
            </p>
          </div>
        </div>
        <CardContent className="space-y-4 pt-6">
          {error && <Alert variant="destructive">{error}</Alert>}

          {!user && (
            <>
              <p className="text-sm text-[var(--muted)]">
                This note is limited to specific emails. Sign in with an
                allowlisted account to open it.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/login?next=${encodeURIComponent(`/share/${shareToken}`)}`}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[#faf6ef] shadow-lg shadow-stone-900/20 sm:w-auto"
                >
                  Sign in
                </Link>
                <Link
                  href={`/register?next=${encodeURIComponent(`/share/${shareToken}`)}`}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-violet-200/80 bg-white/70 px-4 text-sm font-semibold text-violet-950 sm:w-auto"
                >
                  Create account
                </Link>
              </div>
            </>
          )}

          {user && status.viewerAllowed === false && (
            <Alert variant="destructive">
              You&apos;re signed in as <strong>{user.email}</strong>, but that
              address isn&apos;t on this note&apos;s allowlist. View count was
              not increased.
            </Alert>
          )}

          {user && status.viewerAllowed === true && (
            <LoadingOverlay active={opening} label="Opening…">
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Signed in as <strong>{user.email}</strong> — you&apos;re on
                  the list.
                </p>
                <Button
                  className="w-full"
                  size="lg"
                  loading={opening}
                  onClick={() => void openRestricted()}
                >
                  Open note
                </Button>
              </div>
            </LoadingOverlay>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <LoadingBlock
      label={opening ? "Opening note…" : "Preparing…"}
      className={error ? "gap-4" : undefined}
    >
      {error ? (
        <Alert variant="destructive" className="mt-2 max-w-md text-left">
          {error}
        </Alert>
      ) : (
        <Sparkles className="sr-only" />
      )}
    </LoadingBlock>
  );
}
