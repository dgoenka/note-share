"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isSharePage = pathname?.startsWith("/share/");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <FileText className="h-5 w-5" />
            NoteShare
          </Link>
          <nav className="flex items-center gap-2">
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
                <span className="hidden text-sm text-slate-500 sm:inline">
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
                    "text-sm font-medium text-slate-600 hover:text-slate-900"
                  )}
                >
                  Login
                </Link>
                <Button size="sm" onClick={() => router.push("/register")}>
                  Register
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
