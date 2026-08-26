"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import {
  ALLOWED_EMAILS_MAX,
  createNoteSchema,
  type AccessType,
  type NoteDetail,
  type ShareType,
} from "@note-share/shared";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-block";

const NoteEditor = dynamic(
  () => import("@/components/rich-text/note-editor").then((m) => m.NoteEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 items-center justify-center rounded-xl border border-stone-200 bg-white/80 text-sm text-stone-500">
        <Spinner size="sm" /> Loading editor…
      </div>
    ),
  }
);

function defaultExpiryLocal(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoWithOffset(localDatetime: string): string {
  const d = new Date(localDatetime);
  return d.toISOString();
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function NewNoteForm({
  onCancel,
  onCreated,
  compact,
  stayOnSuccess,
  stickyActions,
}: {
  onCancel: () => void;
  /** Called when create finishes (page) or user taps Done after success (dialog). */
  onCreated?: (note: NoteDetail) => void;
  /** Tighter spacing for modal use */
  compact?: boolean;
  /** Dialog: show share link/key in-place instead of navigating away */
  stayOnSuccess?: boolean;
  /** Pin submit/cancel (or Done) to the bottom of the dialog */
  stickyActions?: boolean;
}) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shareType, setShareType] = useState<ShareType>("TIME_BASED");
  const [accessType, setAccessType] = useState<AccessType>("PUBLIC");
  const [expiresLocal, setExpiresLocal] = useState(defaultExpiryLocal);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<NoteDetail | null>(null);
  const [copied, setCopied] = useState<"link" | "key" | null>(null);

  const payload = useMemo(
    () => ({
      title,
      content,
      shareType,
      accessType,
      expiresAt:
        shareType === "TIME_BASED" && expiresLocal
          ? toIsoWithOffset(expiresLocal)
          : null,
      allowedEmails: accessType === "RESTRICTED" ? allowedEmails : undefined,
    }),
    [title, content, shareType, accessType, expiresLocal, allowedEmails]
  );

  function addEmail(raw: string) {
    const email = normalizeEmail(raw);
    if (!email) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.allowedEmails;
      return next;
    });
    if (allowedEmails.includes(email)) {
      setFieldErrors((prev) => ({
        ...prev,
        allowedEmails: "That email is already on the list",
      }));
      return;
    }
    if (allowedEmails.length >= ALLOWED_EMAILS_MAX) {
      setFieldErrors((prev) => ({
        ...prev,
        allowedEmails: `At most ${ALLOWED_EMAILS_MAX} emails`,
      }));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors((prev) => ({
        ...prev,
        allowedEmails: "Enter a valid email address",
      }));
      return;
    }
    setAllowedEmails((prev) => [...prev, email]);
    setEmailDraft("");
  }

  function onEmailKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (emailDraft.trim()) {
        e.preventDefault();
        addEmail(emailDraft);
      }
    } else if (e.key === "Backspace" && !emailDraft && allowedEmails.length) {
      setAllowedEmails((prev) => prev.slice(0, -1));
    }
  }

  async function copyText(kind: "link" | "key", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || submitting) return;
    setError(null);
    setFieldErrors({});

    let emails = allowedEmails;
    if (accessType === "RESTRICTED" && emailDraft.trim()) {
      const next = normalizeEmail(emailDraft);
      if (next && !emails.includes(next)) {
        emails = [...emails, next];
        setAllowedEmails(emails);
      }
      setEmailDraft("");
    }

    const parsed = createNoteSchema.safeParse({
      ...payload,
      allowedEmails: accessType === "RESTRICTED" ? emails : undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const note = await api.createNote(token, parsed.data);
      if (stayOnSuccess) {
        setCreated(note);
        setSubmitting(false);
      } else {
        onCreated?.(note);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create note");
      setSubmitting(false);
    }
  }

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {created ? (
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => onCreated?.(created)}
        >
          Done — back to board
        </Button>
      ) : (
        <>
          <Button
            type="submit"
            form="new-note-form"
            className="w-full sm:w-auto"
            loading={submitting}
          >
            {submitting ? "Minting link…" : "Create & generate share link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </>
      )}
    </div>
  );

  if (created) {
    const successBody = (
      <div className="space-y-4">
        <Alert>
          Note pinned. Copy the share link
          {created.accessKey ? " and access key (shown once)" : ""}.
        </Alert>
        <div className="space-y-2 rounded-2xl border border-stone-200 bg-white/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
            Share link
          </p>
          <p className="break-all font-mono text-xs text-stone-800">
            {created.shareUrl}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => copyText("link", created.shareUrl)}
          >
            {copied === "link" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied === "link" ? "Copied" : "Copy link"}
          </Button>
        </div>
        {created.accessKey && (
          <div className="space-y-2 rounded-2xl border border-amber-300/80 bg-amber-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
              Access key (once)
            </p>
            <p className="font-mono text-sm font-bold text-amber-950">
              {created.accessKey}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copyText("key", created.accessKey!)}
            >
              {copied === "key" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied === "key" ? "Copied" : "Copy key"}
            </Button>
          </div>
        )}
        {!stickyActions && actions}
      </div>
    );

    if (stickyActions) {
      return (
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {successBody}
          </div>
          <div className="shrink-0 border-t border-stone-200/80 bg-[#fffcf5]/95 px-4 py-3 backdrop-blur-sm sm:px-5">
            {actions}
          </div>
        </div>
      );
    }

    return successBody;
  }

  return (
    <LoadingOverlay
      active={submitting}
      label="Minting share link…"
      fill={stickyActions}
    >
      <form
        id="new-note-form"
        onSubmit={onSubmit}
        className={
          stickyActions
            ? "flex h-full min-h-0 flex-col"
            : compact
              ? "space-y-4"
              : "space-y-5"
        }
        aria-busy={submitting}
      >
        <div
          className={
            stickyActions
              ? "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5"
              : undefined
          }
        >
        {error && <Alert variant="destructive">{error}</Alert>}

        <fieldset disabled={submitting} className="space-y-4 border-0 p-0 sm:space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekend Wi‑Fi password"
              required
              maxLength={200}
            />
            {fieldErrors.title && (
              <p className="text-xs text-rose-600">{fieldErrors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            {token ? (
              <NoteEditor
                token={token}
                value={content}
                onChange={setContent}
                disabled={submitting}
              />
            ) : null}
            {fieldErrors.content && (
              <p className="text-xs text-rose-600">{fieldErrors.content}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <Label>Share type</Label>
              <div className="space-y-2 rounded-2xl border border-stone-300/70 bg-white/50 p-3">
                <label className="flex cursor-pointer items-start gap-2 rounded-xl p-2 text-sm transition hover:bg-stone-100/80">
                  <input
                    type="radio"
                    name="shareType"
                    checked={shareType === "TIME_BASED"}
                    onChange={() => setShareType("TIME_BASED")}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="font-semibold">Time-based</span>
                    <span className="block text-xs text-[var(--muted)]">
                      Expires after the selected date/time
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-xl p-2 text-sm transition hover:bg-stone-100/80">
                  <input
                    type="radio"
                    name="shareType"
                    checked={shareType === "ONE_TIME"}
                    onChange={() => setShareType("ONE_TIME")}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="font-semibold">One-time</span>
                    <span className="block text-xs text-[var(--muted)]">
                      Burns after the first successful view
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <Label>Access type</Label>
              <div className="space-y-2 rounded-2xl border border-stone-300/70 bg-white/50 p-3">
                <label className="flex cursor-pointer items-start gap-2 rounded-xl p-2 text-sm transition hover:bg-stone-100/80">
                  <input
                    type="radio"
                    name="accessType"
                    checked={accessType === "PUBLIC"}
                    onChange={() => setAccessType("PUBLIC")}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="font-semibold">Public</span>
                    <span className="block text-xs text-[var(--muted)]">
                      Anyone with the link
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-xl p-2 text-sm transition hover:bg-stone-100/80">
                  <input
                    type="radio"
                    name="accessType"
                    checked={accessType === "PASSWORD"}
                    onChange={() => setAccessType("PASSWORD")}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="font-semibold">Password-protected</span>
                    <span className="block text-xs text-[var(--muted)]">
                      Server-generated access key
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-xl p-2 text-sm transition hover:bg-stone-100/80">
                  <input
                    type="radio"
                    name="accessType"
                    checked={accessType === "RESTRICTED"}
                    onChange={() => setAccessType("RESTRICTED")}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="font-semibold">Email allowlist</span>
                    <span className="block text-xs text-[var(--muted)]">
                      Logged-in users whose email is listed
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          </div>

          {accessType === "RESTRICTED" && (
            <div className="space-y-2">
              <Label htmlFor="allowedEmail">Allowed emails</Label>
              <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-stone-300/70 bg-white/80 p-2 shadow-sm focus-within:ring-2 focus-within:ring-[var(--ring)]">
                {allowedEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-semibold text-stone-900"
                  >
                    <span className="truncate">{email}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-[#ead7c4]"
                      aria-label={`Remove ${email}`}
                      onClick={() =>
                        setAllowedEmails((prev) =>
                          prev.filter((e) => e !== email)
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="allowedEmail"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  onKeyDown={onEmailKeyDown}
                  onBlur={() => {
                    if (emailDraft.trim()) addEmail(emailDraft);
                  }}
                  placeholder={
                    allowedEmails.length ? "Add another…" : "friend@example.com"
                  }
                  className="min-w-[10rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-stone-400/90"
                />
              </div>
              <p className="text-xs text-[var(--muted)]">
                Press Enter or comma to add. Recipients must sign in with that
                email. Max {ALLOWED_EMAILS_MAX}.
              </p>
              {fieldErrors.allowedEmails && (
                <p className="text-xs text-rose-600">
                  {fieldErrors.allowedEmails}
                </p>
              )}
            </div>
          )}

          {shareType === "TIME_BASED" && (
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expiry date/time</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresLocal}
                onChange={(e) => setExpiresLocal(e.target.value)}
                required
              />
              {fieldErrors.expiresAt && (
                <p className="text-xs text-rose-600">{fieldErrors.expiresAt}</p>
              )}
            </div>
          )}

          {!stickyActions && actions}
        </fieldset>
        </div>
        {stickyActions && (
          <div className="shrink-0 border-t border-stone-200/80 bg-[#fffcf5]/95 px-4 py-3 backdrop-blur-sm sm:px-5">
            {actions}
          </div>
        )}
      </form>
    </LoadingOverlay>
  );
}
