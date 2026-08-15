"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

  // Auto-open public links once status is OK
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
          // refresh status (may be used/expired after race)
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
    if (!token) return;
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
    } finally {
      setOpening(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          Checking share link…
        </CardContent>
      </Card>
    );
  }

  if (view) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{view.title}</CardTitle>
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
          <div className="whitespace-pre-wrap rounded-md border border-slate-100 bg-slate-50 p-4 text-sm">
            {view.content}
          </div>
          {view.shareType === "ONE_TIME" && (
            <Alert variant="warning" className="mt-4">
              This was a one-time link. It is now consumed and cannot be opened
              again.
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
      <Card>
        <CardHeader>
          <CardTitle>Link unavailable</CardTitle>
          <CardDescription>
            {messages[reason] || "This share link cannot be opened."}
          </CardDescription>
        </CardHeader>
        {status?.title && (
          <CardContent>
            <p className="text-sm text-slate-500">Note: {status.title}</p>
          </CardContent>
        )}
      </Card>
    );
  }

  if (status.requiresPassword) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{status.title || "Protected note"}</CardTitle>
          <CardDescription>
            Enter the access key to unlock this note.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onUnlock} className="space-y-4">
            {error && <Alert variant="destructive">{error}</Alert>}
            <div className="space-y-2">
              <Label htmlFor="password">Access key / password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={opening}>
              {opening ? "Unlocking…" : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-10 text-center text-sm text-slate-500">
        {opening ? "Opening note…" : "Preparing…"}
        {error && (
          <Alert variant="destructive" className="text-left">
            {error}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
