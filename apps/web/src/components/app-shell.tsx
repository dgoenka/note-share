"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isSharePage = pathname?.startsWith("/share/");

  return (
    <div className="relative min-h-dvh overflow-x-hidden text-[var(--foreground)]">
      <div className="mesh-orb -left-16 top-24 h-40 w-40 bg-fuchsia-300/50 sm:h-56 sm:w-56" />
      <div className="mesh-orb right-[-4rem] top-10 h-44 w-44 bg-violet-300/40 sm:h-64 sm:w-64" />
      <div className="mesh-orb bottom-10 left-1/3 hidden h-48 w-48 bg-cyan-200/40 sm:block" />

      <header className="sticky top-0 z-30 border-b border-violet-200/50 bg-white/55 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-4">
          <Link
            href="/"
            className={cn(
              "group flex min-w-0 items-center gap-2 font-semibold tracking-tight sm:gap-2.5",
              loading && "pointer-events-none opacity-70"
            )}
            tabIndex={loading ? -1 : undefined}
            aria-disabled={loading || undefined}
          >
            <span className="animate-wiggle flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-500/30 sm:h-9 sm:w-9">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display truncate text-base sm:text-lg">
              Note
              <span className="bg-gradient-to-r from-violet-700 to-fuchsia-500 bg-clip-text text-transparent">
                Share
              </span>
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {loading && (
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-100/80 px-2.5 py-1.5 text-xs font-semibold text-violet-800">
                <Spinner size="sm" />
                <span className="hidden xs:inline sm:inline">Session…</span>
              </span>
            )}
            {!loading && user && !isSharePage && (
              <>
                <Button
                  variant={pathname === "/notes/new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => router.push("/notes/new")}
                  aria-label="New note"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New note</span>
                </Button>
                <span className="hidden max-w-[8rem] truncate rounded-full bg-violet-100/80 px-3 py-1 text-xs font-semibold text-violet-800 md:inline">
                  {user.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            )}
            {!loading && !user && !isAuthPage && !isSharePage && (
              <>
                <Link
                  href="/login"
                  className={cn(
                    "px-2 text-sm font-semibold text-violet-700 hover:text-violet-950"
                  )}
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

      <main className="relative z-10 mx-auto w-full max-w-3xl px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}
