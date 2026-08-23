"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

function BoardTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "feed" ? "feed" : "mine";

  function setTab(next: "mine" | "feed") {
    const q = next === "feed" ? "?tab=feed" : "";
    router.replace(`/${q}`);
  }

  return (
    <div
      className="inline-flex rounded-xl border border-amber-950/20 bg-[#faf6ef]/90 p-0.5 shadow-sm"
      role="tablist"
      aria-label="Board"
    >
      {(
        [
          { id: "mine" as const, label: "Mine", long: "My notes" },
          { id: "feed" as const, label: "All", long: "Everyone’s" },
        ] as const
      ).map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm",
            tab === t.id
              ? "bg-[var(--primary)] text-[#faf6ef] shadow"
              : "text-amber-950/80 hover:bg-amber-950/5"
          )}
          onClick={() => setTab(t.id)}
        >
          <span className="sm:hidden">{t.label}</span>
          <span className="hidden sm:inline">{t.long}</span>
        </button>
      ))}
    </div>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isSharePage = pathname?.startsWith("/share/");
  // Softboard chrome: full-viewport corkboard + centered Mine/All tabs.
  // Tab query (`?tab=feed`) remounts <Softboard key={tab}> on the home page.
  const isHomeBoard = pathname === "/" && !!user && !loading;
  const isSoftboardChrome = isHomeBoard;

  return (
    <div
      className={cn(
        "relative overflow-x-hidden text-[var(--foreground)]",
        isSoftboardChrome ? "flex h-dvh flex-col" : "min-h-dvh"
      )}
    >
      {!isSoftboardChrome && (
        <>
          <div className="mesh-orb -left-16 top-24 h-40 w-40 bg-amber-200/45 sm:h-56 sm:w-56" />
          <div className="mesh-orb right-[-4rem] top-10 h-44 w-44 bg-orange-100/50 sm:h-64 sm:w-64" />
          <div className="mesh-orb bottom-10 left-1/3 hidden h-48 w-48 bg-stone-200/40 sm:block" />
        </>
      )}

      <header
        className={cn(
          "z-30 shrink-0 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl",
          isSoftboardChrome
            ? "border-amber-900/15 bg-[#c4a574]/95"
            : "sticky top-0 border-stone-200/70 bg-[#fffcf5]/85"
        )}
      >
        <div
          className={cn(
            "relative flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:px-4",
            !isSoftboardChrome && "mx-auto max-w-3xl"
          )}
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className={cn(
                "group flex min-w-0 items-center gap-2 font-semibold tracking-tight",
                loading && "pointer-events-none opacity-70"
              )}
              tabIndex={loading ? -1 : undefined}
              aria-disabled={loading || undefined}
            >
              <span className="animate-wiggle flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-[#faf6ef] shadow-md shadow-stone-900/20 sm:h-9 sm:w-9">
                <Sparkles className="h-4 w-4" />
              </span>
              <span
                className={cn(
                  "font-display truncate text-base font-semibold sm:text-lg",
                  isSoftboardChrome ? "text-amber-950" : "text-stone-900",
                  // Leave room for centered tabs on narrow softboard header
                  isHomeBoard && "hidden sm:inline"
                )}
              >
                Note
                <span className="text-[var(--accent)]">Share</span>
              </span>
            </Link>
          </div>

          {isHomeBoard && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto">
                <BoardTabs />
              </div>
            </div>
          )}

          <nav className="relative z-10 flex shrink-0 items-center gap-1.5 sm:gap-2">
            {loading && (
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--primary)]">
                <Spinner size="sm" />
              </span>
            )}
            {!loading && user && !isSharePage && (
              <UserMenu user={user} softboard={isSoftboardChrome} />
            )}
            {!loading && !user && !isAuthPage && !isSharePage && (
              <>
                <Link
                  href="/login"
                  className="px-2 text-sm font-semibold text-[var(--primary)] hover:text-stone-900"
                >
                  Login
                </Link>
                <Button size="sm" onClick={() => router.push("/register")}>
                  <span className="sm:hidden">Join</span>
                  <span className="hidden sm:inline">Get started</span>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main
        className={cn(
          "relative z-10",
          isSoftboardChrome
            ? "min-h-0 flex-1"
            : "mx-auto w-full max-w-3xl px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-8"
        )}
      >
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  );
}
