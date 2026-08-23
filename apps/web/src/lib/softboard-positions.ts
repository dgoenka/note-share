/**
 * Softboard pin layout — client-only state (intentional).
 *
 * Positions are NOT stored in Postgres. Each browser keeps freeform
 * drag layout in localStorage so the playground stays light and private.
 *
 * Storage key: `noteshare.softboard.v1:{userId}:{tab}`
 *   - Scoped per signed-in user and per tab (Mine vs Everyone’s).
 *   - Values: `{ [pinId]: { x, y, rot } }`, pruned when pins disappear.
 *
 * Desktop: freeform drag + Arrange (`layoutChronological`).
 * Mobile list mode ignores stored positions and sorts chronologically in UI.
 */
import type { BoardPin } from "@note-share/shared";

export type PinPosition = {
  x: number;
  y: number;
  rot: number;
};

type PositionMap = Record<string, PinPosition>;

const PIN_W = 160;
const PIN_H = 140;
const GAP_X = 20;
const GAP_Y = 24;
const PAD = 20;

/** localStorage key for a user’s softboard layout on one tab */
export function softboardStorageKey(userId: string, tab: "mine" | "feed") {
  return `noteshare.softboard.v1:${userId}:${tab}`;
}

export function loadPositions(
  userId: string,
  tab: "mine" | "feed"
): PositionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(softboardStorageKey(userId, tab));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PositionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePositions(
  userId: string,
  tab: "mine" | "feed",
  map: PositionMap
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(softboardStorageKey(userId, tab), JSON.stringify(map));
}

/** Columns by viewport width: phone list-ish (1–2), tablet 3, desktop 4–5 */
export function columnsForWidth(canvasW: number): number {
  if (canvasW < 480) return 1;
  if (canvasW < 720) return 2;
  if (canvasW < 1024) return 3;
  if (canvasW < 1280) return 4;
  return 5;
}

export function defaultPosition(index: number, canvasW: number): PinPosition {
  const cols = columnsForWidth(canvasW);
  const colW = Math.max(PIN_W + GAP_X, (canvasW - PAD * 2) / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = PAD + col * colW + (index % 3) * 4;
  const y = PAD + row * (PIN_H + GAP_Y) + (index % 2) * 6;
  const rot = ((index * 17) % 11) - 5;
  return { x, y, rot };
}

/** Chronological grid/list: newest first, responsive columns, slight tilt */
export function layoutChronological(
  pins: BoardPin[],
  canvasW: number
): PositionMap {
  const sorted = [...pins].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      b.id.localeCompare(a.id)
  );
  const cols = columnsForWidth(canvasW);
  const usable = Math.max(canvasW - PAD * 2, PIN_W);
  const colW = cols === 1 ? usable : usable / cols;
  const map: PositionMap = {};
  sorted.forEach((pin, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x =
      cols === 1
        ? PAD + Math.max(0, (usable - PIN_W) / 2)
        : PAD + col * colW + Math.max(0, (colW - PIN_W) / 2);
    const y = PAD + row * (PIN_H + GAP_Y);
    const rot = cols === 1 ? 0 : ((index % 5) - 2) * 1.5;
    map[pin.id] = { x, y, rot };
  });
  return map;
}

export function prunePositions(
  map: PositionMap,
  liveIds: Set<string>
): PositionMap {
  const next: PositionMap = {};
  for (const [id, pos] of Object.entries(map)) {
    if (liveIds.has(id)) next[id] = pos;
  }
  return next;
}
