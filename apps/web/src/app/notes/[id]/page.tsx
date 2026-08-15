"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Check, Copy } from "lucide-react";
import type { NoteDetail } from "@note-share/shared";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export default function NoteDetailPage() {
  return (
    <RequireAuth>
      <Suspense
        fallback={<p className="text-sm text-slate-500">Loading note…</p>}
      >
        <NoteDetailView />
      </Suspense>
    </RequireAuth>
  );
}

function NoteDetailView() {
  const { token } = useAuth();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState<"link" | "key" | null>(null);

  // Access key only available from create redirect (never re-fetched from API)
  const accessKeyFromCreate = searchParams.get("accessKey");

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getNote(token, params.id);
      setNote(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load note");
    } finally {
      setLoading(false);
    }
  }, [token, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copy(text: string, kind: "link" | "key") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  async function revoke() {
    if (!token || !note) return;
    if (!confirm("Revoke this share link? It cannot be undone.")) return;
    setRevoking(true);
    setError(null);
    try {
      const updated = await api.revokeNote(token, note.id);
      setNote(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to revoke");
    } finally {
      setRevoking(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading note…</p>;
  }

  if (error && !note) {
    return <Alert variant="destructive">{error}</Alert>;
  }

  if (!note) return null;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
        ← Back to notes
      </Button>

      {error && <Alert variant="destructive">{error}</Alert>}

      {accessKeyFromCreate && note.accessType === "PASSWORD" && (
        <Alert variant="warning">
          <p className="font-medium">Save this access key now</p>
          <p className="mt-1 text-xs">
            It is generated once and is not shown again. Share it only with the
            intended recipient.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded bg-white/70 px-2 py-1 font-mono text-sm">
              {accessKeyFromCreate}
            </code>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => copy(accessKeyFromCreate, "key")}
            >
              {copied === "key" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy key
            </Button>
          </div>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{note.title}</CardTitle>
              <CardDescription>
                Created {formatDateTime(note.createdAt)}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">
                {note.shareType === "ONE_TIME" ? "One-time" : "Time-based"}
              </Badge>
              <Badge variant="secondary">
                {note.accessType === "PUBLIC" ? "Public" : "Password"}
              </Badge>
              {note.isRevoked ? (
                <Badge variant="destructive">Revoked</Badge>
              ) : note.isUsed ? (
                <Badge variant="warning">Used</Badge>
              ) : note.isExpired ? (
                <Badge variant="warning">Expired</Badge>
              ) : (
                <Badge variant="success">Active</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Content
            </h4>
            <div className="whitespace-pre-wrap rounded-md border border-slate-100 bg-slate-50 p-4 text-sm">
              {note.content}
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Share link
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <a
                  href={note.shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-xs text-blue-700 underline"
                >
                  {note.shareUrl}
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => copy(note.shareUrl, "link")}
                >
                  {copied === "link" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copy
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Stats
              </p>
              <p>
                Successful views:{" "}
                <span className="font-semibold">{note.viewCount}</span>
              </p>
              <p>Expires: {formatDateTime(note.expiresAt)}</p>
              <p>Used at: {formatDateTime(note.usedAt)}</p>
              <p>Revoked at: {formatDateTime(note.revokedAt)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button
              variant="destructive"
              onClick={revoke}
              disabled={revoking || note.isRevoked}
            >
              {note.isRevoked
                ? "Already revoked"
                : revoking
                  ? "Revoking…"
                  : "Force invalidate / revoke"}
            </Button>
            <Button variant="outline" onClick={() => void load()}>
              Refresh status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
