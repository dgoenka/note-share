"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User } from "lucide-react";
import type { PublicUser } from "@note-share/shared";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export function UserMenu({
  user,
  softboard,
}: {
  user: PublicUser;
  softboard?: boolean;
}) {
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-[10rem] items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold transition sm:max-w-[12rem] sm:px-2.5 sm:py-1.5",
          softboard
            ? "bg-amber-950/10 text-amber-950 hover:bg-amber-950/15"
            : "bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[#ead7c4]",
          open && (softboard ? "bg-amber-950/20" : "bg-[#ead7c4]")
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
            softboard
              ? "bg-amber-950 text-[#faf6ef]"
              : "bg-[var(--primary)] text-[#faf6ef]"
          )}
        >
          {initials || "?"}
        </span>
        <span className="truncate">{user.name}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 opacity-70 transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-stone-200 bg-[#fffcf5] py-1 shadow-xl shadow-stone-900/15"
        >
          <div className="border-b border-stone-100 px-3 py-2">
            <p className="truncate text-sm font-semibold text-stone-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 text-stone-500" />
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-rose-800 hover:bg-rose-50"
            onClick={() => {
              setOpen(false);
              logout();
              router.push("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
