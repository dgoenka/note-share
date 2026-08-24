"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  ALLOWED_EMAILS_MAX,
  createNoteSchema,
  type AccessType,
  type ShareType,
} from "@note-share/shared";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoteEditor } from "@/components/rich-text/note-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LoadingOverlay } from "@/components/ui/loading-block";

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

export default function NewNotePage() {
  return (
    <RequireAuth>
      <NewNoteForm />
    </RequireAuth>
  );
}

function NewNoteForm() {
  const { token } = useAuth();
  const router = useRouter();
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
      allowedEmails:
        accessType === "RESTRICTED" ? allowedEmails : undefined,
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
    // light client check; Zod still validates on submit
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || submitting) return;
    setError(null);
    setFieldErrors({});

    // Flush draft chip before validate
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
      const q =
        note.accessKey != null
          ? `?accessKey=${encodeURIComponent(note.accessKey)}`
          : "";
      router.replace(`/notes/${note.id}${q}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create note");
      setSubmitting(false);
    }
  }

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
        <LoadingOverlay active={submitting} label="Minting share link…">
          <form onSubmit={onSubmit} className="space-y-5" aria-busy={submitting}>
            {error && <Alert variant="destructive">{error}</Alert>}

            <fieldset disabled={submitting} className="space-y-5 border-0 p-0">
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
                        allowedEmails.length
                          ? "Add another…"
                          : "friend@example.com"
                      }
                      className="min-w-[10rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-violet-400/80"
                    />
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    Press Enter or comma to add. Recipients must sign in with
                    that email. Max {ALLOWED_EMAILS_MAX}.
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
                    <p className="text-xs text-rose-600">
                      {fieldErrors.expiresAt}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  loading={submitting}
                >
                  {submitting
                    ? "Minting link…"
                    : "Create & generate share link"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={submitting}
                  onClick={() => router.push("/")}
                >
                  Cancel
                </Button>
              </div>
            </fieldset>
          </form>
        </LoadingOverlay>
      </CardContent>
    </Card>
  );
}
