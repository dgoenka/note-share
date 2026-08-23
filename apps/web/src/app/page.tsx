"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  KeyRound,
  Plus,
  Sparkles,
  Timer,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock } from "@/components/ui/loading-block";
import { Softboard } from "@/components/softboard/softboard";
import { cn } from "@/lib/utils";

type BoardTab = "mine" | "feed";

export default function HomePage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<BoardTab>("mine");

  if (loading) {
    return <LoadingBlock label="Warming up…" />;
  }

  if (!user || !token) {
    return (
      <div className="space-y-8">
        <section className="animate-fade-up relative overflow-hidden rounded-3xl border border-violet-200/60 bg-white/60 p-5 shadow-[var(--shadow)] backdrop-blur-xl sm:rounded-[2rem] sm:p-10">
          <div className="mesh-orb -right-10 -top-10 h-32 w-32 bg-fuchsia-300/60 sm:h-40 sm:w-40" />
          <div className="mesh-orb bottom-0 left-10 h-24 w-24 bg-cyan-200/50 sm:h-28 sm:w-28" />
          <div className="relative space-y-4 sm:space-y-5">
            <Badge className="bg-violet-100 text-violet-800">
              <Sparkles className="mr-1 h-3 w-3" />
              Expiring share links
            </Badge>
            <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-5xl">
              Notes with controlled
              <br />
              <span className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-rose-500 bg-clip-text text-transparent">
                share access
              </span>
            </h1>
            <p className="max-w-xl text-sm text-[var(--muted)] sm:text-lg">
              Create a note, generate a share link, and choose one-time or
              time-based expiry. Optionally require a password or an email
              allowlist.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => router.push("/register")}
              >
                Create account
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => router.push("/login")}
              >
                Sign in
              </Button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Demo path: register → New note → copy share link → open in a
              private window.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              icon: Timer,
              title: "One-time links",
              body: "Invalid after the first successful open.",
            },
            {
              icon: Clock3,
              title: "Timed expiry",
              body: "Rejects opens after the configured deadline.",
            },
            {
              icon: KeyRound,
              title: "Access controls",
              body: "Public, password, or logged-in email allowlist.",
            },
          ].map((item) => (
            <Card
              key={item.title}
              className="animate-fade-up p-5 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500 sm:text-sm">
            Softboard
          </p>
          <h1 className="font-display text-2xl tracking-tight sm:text-4xl">
            Pinned notes
          </h1>
          <p className="mt-1 truncate text-sm text-[var(--muted)]">
            Signed in as {user.email}
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => router.push("/notes/new")}
        >
          <Plus className="h-4 w-4" />
          New note
        </Button>
      </div>

      <div
        className="inline-flex rounded-2xl border border-violet-200/70 bg-white/70 p-1 shadow-sm"
        role="tablist"
        aria-label="Board source"
      >
        {(
          [
            { id: "mine" as const, label: "My notes" },
            { id: "feed" as const, label: "Everyone’s" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              tab === t.id
                ? "bg-violet-600 text-white shadow"
                : "text-violet-800 hover:bg-violet-50"
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--muted)]">
        {tab === "mine"
          ? "Your notes as draggable post-its. Click to open."
          : "Public notes from others, plus restricted notes allowlisted to your email."}
      </p>

      <Softboard key={tab} userId={user.id} token={token} tab={tab} />
    </div>
  );
}
