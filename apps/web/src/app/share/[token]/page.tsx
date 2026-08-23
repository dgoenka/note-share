"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { KeyRound, Sparkles } from "lucide-react";
import type { ShareStatus, SharedNoteView } from "@note-share/shared";
import { unlockShareSchema } from "@note-share/shared";
import { api, ApiError } from "@/lib/api";
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
  const token = params.token;

  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [view, setView] = useState<SharedNoteView | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const s = await api.shareStatus(token);
      setStatus(s);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load share link"
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status || !token || view) return;
    if (!status.valid || status.requiresPassword) return;

    let cancelled = false;
    (async () => {
      setOpening(true);
      setError(null);
      try {
        const opened = await api.openShare(token);
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
  }, [status, token, view, loadStatus]);

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    if (!token || opening) return;
    setError(null);

    const parsed = unlockShareSchema.safeParse({ password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Invalid password");
      return;
    }

    setOpening(true);
    try {
      const opened = await api.unlockShare(token, parsed.data.password);
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

  if (loading) {
    return <LoadingBlock label="Peeking at this share link…" />;
  }

  if (view) {
    return (
      <Card className="animate-fade-up overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-400" />
        <CardHeader>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-500">
            Shared note
          </p>
          <CardTitle className="text-3xl">{view.title}</CardTitle>
          <CardDescription>
            {view.shareType === "ONE_TIME" ? "One-time" : "Time-based"}
            {" · "}
            {view.accessType === "PUBLIC" ? "Public" : "Password-protected"}
            {view.expiresAt
              ? ` · Expires ${formatDateTime(view.expiresAt)}`
              : ""}
            {" · "}
            Views: {view.viewCount}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/60 p-5 text-sm leading-relaxed shadow-inner">
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
          <CardTitle className="text-3xl">Link unavailable</CardTitle>
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
        <div className="flex items-center gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-6 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-500">
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
