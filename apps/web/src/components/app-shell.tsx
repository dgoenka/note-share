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
    <div className="relative min-h-screen overflow-x-hidden text-[var(--foreground)]">
      <div className="mesh-orb -left-16 top-24 h-56 w-56 bg-fuchsia-300/50" />
      <div className="mesh-orb right-[-4rem] top-10 h-64 w-64 bg-violet-300/40" />
      <div className="mesh-orb bottom-10 left-1/3 h-48 w-48 bg-cyan-200/40" />

      <header className="sticky top-0 z-30 border-b border-violet-200/50 bg-white/55 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link
            href="/"
            className={cn(
              "group flex items-center gap-2.5 font-semibold tracking-tight",
              loading && "pointer-events-none opacity-70"
            )}
            tabIndex={loading ? -1 : undefined}
            aria-disabled={loading || undefined}
          >
            <span className="animate-wiggle flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-500/30">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-lg">
              Note
              <span className="bg-gradient-to-r from-violet-700 to-fuchsia-500 bg-clip-text text-transparent">
                Share
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            {loading && (
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-100/80 px-3 py-1.5 text-xs font-semibold text-violet-800">
                <Spinner size="sm" />
                Session…
              </span>
            )}
            {!loading && user && !isSharePage && (
              <>
                <Button
                  variant={pathname === "/notes/new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => router.push("/notes/new")}
                >
                  <Plus className="h-4 w-4" />
                  New note
                </Button>
                <span className="hidden max-w-[10rem] truncate rounded-full bg-violet-100/80 px-3 py-1 text-xs font-semibold text-violet-800 sm:inline">
                  {user.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </>
            )}
            {!loading && !user && !isAuthPage && !isSharePage && (
              <>
                <Link
                  href="/login"
                  className={cn(
                    "text-sm font-semibold text-violet-700 hover:text-violet-950"
                  )}
                >
                  Login
                </Link>
                <Button size="sm" onClick={() => router.push("/register")}>
                  Get started
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
