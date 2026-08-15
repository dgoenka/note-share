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
    if (!token) return;
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create note");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create note</CardTitle>
        <CardDescription>
          A secure share link is generated on create. For password-protected
          notes, the access key is shown once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          {error && <Alert variant="destructive">{error}</Alert>}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
            {fieldErrors.title && (
              <p className="text-xs text-red-600">{fieldErrors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={8}
            />
            {fieldErrors.content && (
              <p className="text-xs text-red-600">{fieldErrors.content}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <Label>Share type</Label>
              <div className="space-y-2 rounded-md border border-slate-200 p-3">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="shareType"
                    checked={shareType === "TIME_BASED"}
                    onChange={() => setShareType("TIME_BASED")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Time-based</span>
                    <span className="block text-xs text-slate-500">
                      Expires after the selected date/time
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="shareType"
                    checked={shareType === "ONE_TIME"}
                    onChange={() => setShareType("ONE_TIME")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">One-time</span>
                    <span className="block text-xs text-slate-500">
                      Invalid after the first successful view
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <Label>Access type</Label>
              <div className="space-y-2 rounded-md border border-slate-200 p-3">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="accessType"
                    checked={accessType === "PUBLIC"}
                    onChange={() => setAccessType("PUBLIC")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Public</span>
                    <span className="block text-xs text-slate-500">
                      Anyone with the link can open it
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="accessType"
                    checked={accessType === "PASSWORD"}
                    onChange={() => setAccessType("PASSWORD")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Password-protected</span>
                    <span className="block text-xs text-slate-500">
                      Server generates a one-time access key
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
                <p className="text-xs text-red-600">{fieldErrors.expiresAt}</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create & generate share link"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
