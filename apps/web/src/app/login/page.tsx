"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { loginSchema } from "@note-share/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock, LoadingOverlay } from "@/components/ui/loading-block";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading…" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { setSession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
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
      const res = await api.login(parsed.data);
      setSession(res.token, res.user);
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
      setSubmitting(false);
    }
  }

  return (
    <Card className="animate-fade-up mx-auto max-w-md overflow-hidden">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-500">
          Welcome back
        </p>
        <CardTitle className="text-2xl sm:text-3xl">Log in</CardTitle>
        <CardDescription>
          Hop back in and keep those share links under control.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoadingOverlay active={submitting} label="Signing in…">
          <form onSubmit={onSubmit} className="space-y-4" aria-busy={submitting}>
            {error && <Alert variant="destructive">{error}</Alert>}
            <fieldset disabled={submitting} className="space-y-4 border-0 p-0">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {fieldErrors.email && (
                  <p className="text-xs text-rose-600">{fieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {fieldErrors.password && (
                  <p className="text-xs text-rose-600">{fieldErrors.password}</p>
                )}
              </div>
              <Button type="submit" className="w-full" size="lg" loading={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </fieldset>
            <p className="text-center text-sm text-[var(--muted)]">
              New here?{" "}
              <Link
                href={
                  nextPath !== "/"
                    ? `/register?next=${encodeURIComponent(nextPath)}`
                    : "/register"
                }
                className={
                  submitting
                    ? "pointer-events-none font-bold text-violet-400"
                    : "font-bold text-violet-700 underline decoration-violet-300 underline-offset-4"
                }
                tabIndex={submitting ? -1 : undefined}
                aria-disabled={submitting || undefined}
              >
                Create an account
              </Link>
            </p>
          </form>
        </LoadingOverlay>
      </CardContent>
    </Card>
  );
}
