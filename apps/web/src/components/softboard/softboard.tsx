"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardPin } from "@note-share/shared";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/loading-block";
import { Spinner } from "@/components/ui/spinner";
import {
  defaultPosition,
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
          // de-dupe by id
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

  // Assign default positions for new pins + persist
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

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && nextCursor && !loadingMore && !loading) {
          void fetchPage(nextCursor, true);
        }
      },
      { root: canvasRef.current, rootMargin: "120px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [nextCursor, loadingMore, loading, fetchPage]);

  const canvasHeight = useMemo(() => {
    const maxY = Object.values(positions).reduce(
      (m, p) => Math.max(m, p.y + 180),
      640
    );
    return Math.max(640, maxY + 120);
  }, [positions]);

  if (loading && pins.length === 0) {
    return <LoadingBlock label="Laying out the softboard…" />;
  }

  return (
    <div className="space-y-3">
      {error && <Alert variant="destructive">{error}</Alert>}

      <div
        ref={canvasRef}
        className="softboard-canvas relative w-full overflow-auto rounded-3xl border border-amber-900/20 shadow-inner"
        style={{ height: "min(70vh, 720px)" }}
      >
        <div className="relative w-full" style={{ height: canvasHeight, minWidth: "100%" }}>
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
            <p className="absolute left-1/2 top-1/3 w-[min(20rem,90%)] -translate-x-1/2 text-center text-sm font-semibold text-amber-950/70">
              {tab === "mine"
                ? "No notes yet — create one and it’ll pin here."
                : "No public or allowlisted notes from others yet."}
            </p>
          )}

          <div ref={sentinelRef} className="absolute bottom-4 left-0 h-4 w-full" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--muted)]">
          Drag pins to rearrange (saved in this browser). Click a pin to open.
        </p>
        {nextCursor && (
          <Button
            size="sm"
            variant="outline"
            loading={loadingMore}
            onClick={() => void fetchPage(nextCursor, true)}
          >
            {loadingMore ? (
              <>
                <Spinner size="sm" /> Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
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
