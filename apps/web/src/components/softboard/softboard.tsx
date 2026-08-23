"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Plus } from "lucide-react";
import type { BoardPin } from "@note-share/shared";
import { api, ApiError } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  defaultPosition,
  layoutChronological,
  loadPositions,
  prunePositions,
  savePositions,
  type PinPosition,
} from "@/lib/softboard-positions";
import { PostItPin } from "@/components/softboard/post-it-pin";
import { PostItDialog } from "@/components/softboard/post-it-dialog";

export function Softboard({
  userId,
  token,
  tab,
}: {
  userId: string;
  token: string;
  tab: "mine" | "feed";
}) {
  const router = useRouter();
  const [pins, setPins] = useState<BoardPin[]>([]);
  const [positions, setPositions] = useState<Record<string, PinPosition>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<BoardPin | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const page =
          tab === "mine"
            ? await api.boardMine(token, { cursor, limit: 24 })
            : await api.boardFeed(token, { cursor, limit: 24 });
        setPins((prev) => {
          const merged = append ? [...prev, ...page.items] : page.items;
          const seen = new Set<string>();
          return merged.filter((p) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
        });
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load board");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab, token]
  );

  useEffect(() => {
    setPins([]);
    setNextCursor(null);
    setPositions(loadPositions(userId, tab));
    void fetchPage(null, false);
  }, [userId, tab, fetchPage]);

  useEffect(() => {
    if (!pins.length) return;
    setPositions((prev) => {
      const canvasW = canvasRef.current?.clientWidth ?? 900;
      const next = { ...prev };
      let changed = false;
      pins.forEach((pin, index) => {
        if (!next[pin.id]) {
          next[pin.id] = defaultPosition(index, canvasW);
          changed = true;
        }
      });
      const pruned = prunePositions(next, new Set(pins.map((p) => p.id)));
      if (changed || Object.keys(pruned).length !== Object.keys(next).length) {
        savePositions(userId, tab, pruned);
        return pruned;
      }
      return next;
    });
  }, [pins, userId, tab]);

  const onMove = useCallback(
    (id: string, pos: PinPosition) => {
      setPositions((prev) => {
        const next = { ...prev, [id]: pos };
        savePositions(userId, tab, next);
        return next;
      });
    },
    [userId, tab]
  );

  const rearrange = useCallback(() => {
    const canvasW = canvasRef.current?.clientWidth ?? 900;
    const next = layoutChronological(pins, canvasW);
    setPositions(next);
    savePositions(userId, tab, next);
    // scroll to top so the chronological grid is visible
    canvasRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [pins, userId, tab]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          nextCursor &&
          !loadingMore &&
          !loading
        ) {
          void fetchPage(nextCursor, true);
        }
      },
      { root: canvasRef.current, rootMargin: "160px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [nextCursor, loadingMore, loading, fetchPage]);

  const canvasHeight = useMemo(() => {
    const maxY = Object.values(positions).reduce(
      (m, p) => Math.max(m, p.y + 180),
      480
    );
    return Math.max(480, maxY + 160);
  }, [positions]);

  return (
    <div className="relative h-full min-h-0 w-full">
      {error && (
        <div className="absolute left-3 right-3 top-3 z-20">
          <Alert variant="destructive">{error}</Alert>
        </div>
      )}

      <div
        ref={canvasRef}
        className="softboard-canvas h-full w-full overflow-auto"
      >
        <div
          className="relative w-full"
          style={{ height: canvasHeight, minWidth: "100%" }}
        >
          {loading && pins.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold text-amber-950/70">
              <Spinner size="sm" className="text-amber-950" /> Loading…
            </div>
          )}

          {pins.map((pin) => {
            const pos = positions[pin.id];
            if (!pos) return null;
            return (
              <PostItPin
                key={pin.id}
                pin={pin}
                position={pos}
                onMove={onMove}
                onOpen={setActive}
              />
            );
          })}

          {!loading && pins.length === 0 && (
            <p className="absolute left-1/2 top-[40%] w-[min(18rem,90%)] -translate-x-1/2 text-center text-sm font-semibold text-amber-950/70">
              {tab === "mine"
                ? "Empty board — tap + to pin a note."
                : "Nothing from others yet."}
            </p>
          )}

          <div
            ref={sentinelRef}
            className="absolute bottom-8 left-0 flex h-10 w-full items-center justify-center"
          >
            {loadingMore && (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-950/10 px-3 py-1 text-xs font-semibold text-amber-950">
                <Spinner size="sm" className="text-amber-950" /> More…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* FABs */}
      <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-30 flex flex-col items-end gap-2 sm:right-5">
        <button
          type="button"
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-amber-950 shadow-lg ring-1 ring-amber-900/15 transition hover:bg-white active:scale-95"
          aria-label="Rearrange chronologically"
          title="Rearrange chronologically"
          onClick={rearrange}
          disabled={!pins.length}
        >
          <LayoutGrid className="h-5 w-5" />
        </button>
        {tab === "mine" && (
          <button
            type="button"
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-[#faf6ef] shadow-xl shadow-stone-900/25 transition hover:bg-[#4a3125] active:scale-95"
            aria-label="New note"
            title="New note"
            onClick={() => router.push("/notes/new")}
          >
            <Plus className="h-7 w-7" />
          </button>
        )}
      </div>

      {active && (
        <PostItDialog
          pin={active}
          tab={tab}
          authToken={token}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
