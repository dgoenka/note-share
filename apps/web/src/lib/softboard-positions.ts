export type PinPosition = {
  x: number;
  y: number;
  rot: number;
};

type PositionMap = Record<string, PinPosition>;

function key(userId: string, tab: "mine" | "feed") {
  return `noteshare.softboard.v1:${userId}:${tab}`;
}

export function loadPositions(
  userId: string,
  tab: "mine" | "feed"
): PositionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key(userId, tab));
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
  localStorage.setItem(key(userId, tab), JSON.stringify(map));
}

export function defaultPosition(index: number, canvasW: number): PinPosition {
  const col = index % 4;
  const row = Math.floor(index / 4);
  const x = 24 + col * Math.min(220, canvasW / 4) + (index % 3) * 8;
  const y = 24 + row * 160 + (index % 2) * 12;
  const rot = ((index * 17) % 13) - 6;
  return { x, y, rot };
}

export function prunePositions(map: PositionMap, liveIds: Set<string>): PositionMap {
  const next: PositionMap = {};
  for (const [id, pos] of Object.entries(map)) {
    if (liveIds.has(id)) next[id] = pos;
  }
  return next;
}
