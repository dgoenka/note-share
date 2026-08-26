"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListOrdered, Plus } from "lucide-react";
import type { BoardPin, NoteDetail } from "@note-share/shared";
import { api, ApiError } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobileBoard } from "@/lib/use-media-query";
import {
  defaultPosition,
  layoutChronological,
  loadPositions,
  prunePositions,
  savePositions,
  type PinPosition,
} from "@/lib/softboard-positions";
import { PostItListItem, PostItPin } from "@/components/softboard/post-it-pin";
import { PostItDialog } from "@/components/softboard/post-it-dialog";
import { NewNoteDialog } from "@/components/notes/new-note-dialog";

function sortChronological(pins: BoardPin[]) {
  return [...pins].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      b.id.localeCompare(a.id)
  );
}

export function Softboard({
  userId,
  token,
  tab,
}: {
  userId: string;
  token: string;
  tab: "mine" | "feed";
}) {
  const isMobile = useIsMobileBoard();
  const [pins, setPins] = useState<BoardPin[]>([]);
  const [positions, setPositions] = useState<Record<string, PinPosition>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<BoardPin | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const tabCacheRef = useRef<
    Record<"mine" | "feed", { pins: BoardPin[]; nextCursor: string | null } | undefined>
  >({
    mine: undefined,
    feed: undefined,
  });

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean, silent = false) => {
      if (append) setLoadingMore(true);
      else if (!silent) setLoading(true);
      setError(null);
      try {
        const page =
          tab === "mine"
            ? await api.boardMine(token, { cursor, limit: 24 })
            : await api.boardFeed(token, { cursor, limit: 24 });
        setPins((prev) => {
          const merged = append ? [...prev, ...page.items] : page.items;
          const seen = new Set<string>();
          const deduped = merged.filter((p) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });
          tabCacheRef.current[tab] = { pins: deduped, nextCursor: page.nextCursor };
          return deduped;
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
    const cached = tabCacheRef.current[tab];
    if (cached) {
      setPins(cached.pins);
      setNextCursor(cached.nextCursor);
      setLoading(false);
      if (!isMobile) setPositions(loadPositions(userId, tab));
      void fetchPage(null, false, true);
    } else {
      setPins([]);
      setNextCursor(null);
      if (!isMobile) setPositions(loadPositions(userId, tab));
      void fetchPage(null, false, false);
    }
  }, [userId, tab, fetchPage, isMobile]);

  // Desktop: assign default freeform positions for new pins
  useEffect(() => {
    if (isMobile || !pins.length) return;
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
  }, [pins, userId, tab, isMobile]);

  const onMove = useCallback(
    (id: string, pos: PinPosition) => {
      if (isMobile) return;
      setPositions((prev) => ({ ...prev, [id]: pos }));
    },
    [isMobile]
  );

  const onMoveEnd = useCallback(
    (id: string, pos: PinPosition) => {
      if (isMobile) return;
      setPositions((prev) => {
        const next = { ...prev, [id]: pos };
        savePositions(userId, tab, next);
        return next;
      });
    },
    [userId, tab, isMobile]
  );

  const tidyUp = useCallback(() => {
    const canvasW = canvasRef.current?.clientWidth ?? 900;
    const next = layoutChronological(pins, canvasW);
    setPositions(next);
    savePositions(userId, tab, next);
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

  const mobileList = useMemo(
    () => (isMobile ? sortChronological(pins) : pins),
    [isMobile, pins]
  );

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
        {isMobile ? (
          <div className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-3 px-3 py-4 pb-28">
            {loading && pins.length === 0 && (
              <div className="flex flex-1 items-center justify-center gap-2 py-20 text-sm font-semibold text-amber-950/70">
                <Spinner size="sm" className="text-amber-950" /> Loading…
              </div>
            )}
            {!loading && pins.length === 0 && (
              <p className="py-20 text-center text-sm font-semibold text-amber-950/70">
                {tab === "mine"
                  ? "Empty board — tap + to add a note."
                  : "Nothing from others yet."}
              </p>
            )}
            {mobileList.map((pin) => (
              <PostItListItem key={pin.id} pin={pin} onOpen={setActive} />
            ))}
            <div
              ref={sentinelRef}
              className="flex h-10 items-center justify-center"
            >
              {loadingMore && (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-950/10 px-3 py-1 text-xs font-semibold text-amber-950">
                  <Spinner size="sm" className="text-amber-950" /> More…
                </span>
              )}
            </div>
          </div>
        ) : (
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
                  draggable
                  onMove={onMove}
                  onMoveEnd={onMoveEnd}
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
        )}
      </div>

      {/* FABs — matching labeled pills */}
      <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-30 flex flex-col items-end gap-2 sm:right-5">
        {!isMobile && (
          <button
            type="button"
            className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full bg-white/95 px-3.5 text-sm font-semibold text-amber-950 shadow-lg ring-1 ring-amber-900/15 transition hover:bg-white active:scale-95 disabled:opacity-40"
            aria-label="Arrange notes in order"
            title="Arrange notes in chronological order"
            onClick={tidyUp}
            disabled={!pins.length}
          >
            <ListOrdered className="h-4 w-4" />
            Arrange
          </button>
        )}
        {tab === "mine" && (
          <button
            type="button"
            className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full bg-[var(--primary)] px-3.5 text-sm font-semibold text-[#faf6ef] shadow-xl shadow-stone-900/25 transition hover:bg-[#4a3125] active:scale-95"
            aria-label="New note"
            title="New note"
            onClick={() => setComposeOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New note
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

      {composeOpen && (
        <NewNoteDialog
          onClose={() => setComposeOpen(false)}
          onCreated={(note: NoteDetail) => {
            const pin: BoardPin = {
              id: note.id,
              title: note.title,
              shareToken: note.shareToken,
              shareType: note.shareType,
              accessType: note.accessType,
              ownerName: "you",
              isOwner: true,
              viewCount: note.viewCount,
              expiresAt: note.expiresAt,
              revokedAt: note.revokedAt,
              usedAt: note.usedAt,
              isExpired: note.isExpired,
              isRevoked: note.isRevoked,
              isUsed: note.isUsed,
              isAccessible: note.isAccessible,
              createdAt: note.createdAt,
            };
            tabCacheRef.current.mine = undefined;
            setPins((prev) => [pin, ...prev.filter((p) => p.id !== pin.id)]);
            void fetchPage(null, false, true);
          }}
        />
      )}
    </div>
  );
}
