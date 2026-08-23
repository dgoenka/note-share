"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createNoteSchema,
  type AccessType,
  type ShareType,
} from "@note-share/shared";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  // datetime-local has no timezone; convert via Date to ISO with offset
  const d = new Date(localDatetime);
  return d.toISOString();
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
    }),
    [title, content, shareType, accessType, expiresLocal]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || submitting) return;
    setError(null);
    setFieldErrors({});

    const parsed = createNoteSchema.safeParse(payload);
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
      // Access key (if any) is only on the create response — pass via query once
      const q =
        note.accessKey != null
          ? `?accessKey=${encodeURIComponent(note.accessKey)}`
          : "";
      router.replace(`/notes/${note.id}${q}`);
      // Keep overlay up until navigation — don't clear submitting on success
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create note");
      setSubmitting(false);
    }
  }

  return (
    <Card className="animate-fade-up overflow-hidden">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-500">
          Compose
        </p>
        <CardTitle className="text-3xl">Create a note</CardTitle>
        <CardDescription>
          We mint a secure share link on create. Password notes get a
          one-time access key — grab it before it disappears.
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
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the secret sauce…"
                  required
                  rows={8}
                />
                {fieldErrors.content && (
                  <p className="text-xs text-rose-600">{fieldErrors.content}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <fieldset className="space-y-2">
                  <Label>Share type</Label>
                  <div className="space-y-2 rounded-2xl border border-violet-200/70 bg-white/50 p-3">
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl p-2 text-sm transition hover:bg-violet-50/80">
                      <input
                        type="radio"
                        name="shareType"
                        checked={shareType === "TIME_BASED"}
                        onChange={() => setShareType("TIME_BASED")}
                        className="mt-1 accent-violet-600"
                      />
                      <span>
                        <span className="font-semibold">Time-based</span>
                        <span className="block text-xs text-[var(--muted)]">
                          Expires after the selected date/time
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl p-2 text-sm transition hover:bg-violet-50/80">
                      <input
                        type="radio"
                        name="shareType"
                        checked={shareType === "ONE_TIME"}
                        onChange={() => setShareType("ONE_TIME")}
                        className="mt-1 accent-violet-600"
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
                  <div className="space-y-2 rounded-2xl border border-violet-200/70 bg-white/50 p-3">
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl p-2 text-sm transition hover:bg-violet-50/80">
                      <input
                        type="radio"
                        name="accessType"
                        checked={accessType === "PUBLIC"}
                        onChange={() => setAccessType("PUBLIC")}
                        className="mt-1 accent-violet-600"
                      />
                      <span>
                        <span className="font-semibold">Public</span>
                        <span className="block text-xs text-[var(--muted)]">
                          Anyone with the link can open it
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl p-2 text-sm transition hover:bg-violet-50/80">
                      <input
                        type="radio"
                        name="accessType"
                        checked={accessType === "PASSWORD"}
                        onChange={() => setAccessType("PASSWORD")}
                        className="mt-1 accent-violet-600"
                      />
                      <span>
                        <span className="font-semibold">Password-protected</span>
                        <span className="block text-xs text-[var(--muted)]">
                          We generate a one-time access key
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>
              </div>

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

              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={submitting}>
                  {submitting
                    ? "Minting link…"
                    : "Create & generate share link"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
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
