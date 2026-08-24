"use client";

import { FormEvent, useEffect, useState } from "react";
import type { BoardPin, NoteDetail, SharedNoteView } from "@note-share/shared";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime } from "@/lib/utils";
import { RichContent } from "@/components/rich-text/rich-content";

export function PostItDialog({
  pin,
  tab,
  authToken,
  onClose,
}: {
  pin: BoardPin;
  tab: "mine" | "feed";
  authToken: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [shared, setShared] = useState<SharedNoteView | null>(null);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setDetail(null);
      setShared(null);
      try {
        if (tab === "mine" || pin.isOwner) {
          const note = await api.getNote(authToken, pin.id);
          if (!cancelled) setDetail(note);
        } else if (pin.accessType === "PUBLIC" || pin.accessType === "RESTRICTED") {
          const view = await api.openShare(pin.shareToken, authToken);
          if (!cancelled) setShared(view);
        } else {
          // Password notes from others are not on the feed by design
          if (!cancelled) {
            setError("This note requires a share link and access key.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Could not open note"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pin, tab, authToken]);

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    if (unlocking) return;
    setUnlocking(true);
    setError(null);
    try {
      const view = await api.unlockShare(pin.shareToken, password);
      setShared(view);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unlock failed");
    } finally {
      setUnlocking(false);
    }
  }

  const body = detail?.content ?? shared?.content;
  const mediaUrls = detail?.mediaUrls ?? shared?.mediaUrls;
  const meta = detail ?? shared;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-3 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={pin.title}
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-auto rounded-md border border-[#e8d56a] bg-[#fff8c6] p-5 shadow-2xl sm:p-6"
        style={{ transform: "rotate(-1deg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-rose-500 shadow ring-2 ring-white/80" />
        <div className="mb-3 flex items-start justify-between gap-3 pt-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
              {pin.ownerName}
              {pin.isOwner ? " · you" : ""}
            </p>
            <h2 className="font-display text-2xl font-semibold leading-tight text-stone-900">
              {pin.title}
            </h2>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-stone-600">
            <Spinner size="sm" /> Opening…
          </div>
        )}

        {error && !body && (
          <Alert variant="destructive" className="mb-3">
            {error}
          </Alert>
        )}

        {body && (
          <div className="space-y-3">
            <RichContent html={body} mediaUrls={mediaUrls} />
            {meta && (
              <p className="text-xs text-stone-500">
                {meta.shareType === "ONE_TIME" ? "One-time" : "Time-based"}
                {" · "}
                {meta.accessType}
                {" · "}
                Views: {meta.viewCount}
                {meta.expiresAt
                  ? ` · Expires ${formatDateTime(meta.expiresAt)}`
                  : ""}
              </p>
            )}
            {detail && (
              <a
                href={`/notes/${detail.id}`}
                className="inline-block text-xs font-semibold text-[var(--accent)] underline"
              >
                Open full note page
              </a>
            )}
          </div>
        )}

        {!loading &&
          !body &&
          pin.accessType === "PASSWORD" &&
          !pin.isOwner && (
            <form onSubmit={onUnlock} className="space-y-3">
              <p className="text-sm text-stone-600">
                Enter the access key to unlock this note.
              </p>
              <div className="space-y-2">
                <Label htmlFor="softboard-key">Access key</Label>
                <Input
                  id="softboard-key"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" loading={unlocking}>
                Unlock
              </Button>
            </form>
          )}
      </div>
    </div>
  );
}
