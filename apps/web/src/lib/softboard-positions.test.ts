import { beforeEach, describe, expect, it } from "vitest";
import type { BoardPin } from "@note-share/shared";
import {
  columnsForWidth,
  defaultPosition,
  layoutChronological,
  loadPositions,
  prunePositions,
  savePositions,
  softboardStorageKey,
} from "@/lib/softboard-positions";

function pin(id: string, createdAt: string): BoardPin {
  return {
    id,
    title: id,
    shareToken: `t-${id}`,
    shareType: "TIME_BASED",
    accessType: "PUBLIC",
    ownerName: "Ada",
    isOwner: true,
    viewCount: 0,
    expiresAt: null,
    revokedAt: null,
    usedAt: null,
    isExpired: false,
    isRevoked: false,
    isUsed: false,
    isAccessible: true,
    createdAt,
  };
}

describe("softboardStorageKey", () => {
  it("scopes by user and tab", () => {
    expect(softboardStorageKey("u1", "mine")).toBe(
      "noteshare.softboard.v1:u1:mine"
    );
    expect(softboardStorageKey("u1", "feed")).toBe(
      "noteshare.softboard.v1:u1:feed"
    );
    expect(softboardStorageKey("u2", "mine")).not.toBe(
      softboardStorageKey("u1", "mine")
    );
  });
});

describe("loadPositions / savePositions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps mine, feed, and other users isolated", () => {
    savePositions("alice", "mine", { a: { x: 1, y: 2, rot: 0 } });
    savePositions("alice", "feed", { b: { x: 3, y: 4, rot: 1 } });
    savePositions("bob", "mine", { c: { x: 5, y: 6, rot: -1 } });

    expect(loadPositions("alice", "mine")).toEqual({
      a: { x: 1, y: 2, rot: 0 },
    });
    expect(loadPositions("alice", "feed")).toEqual({
      b: { x: 3, y: 4, rot: 1 },
    });
    expect(loadPositions("bob", "mine")).toEqual({
      c: { x: 5, y: 6, rot: -1 },
    });
    expect(localStorage.getItem(softboardStorageKey("alice", "mine"))).toContain(
      '"a"'
    );
  });

  it("returns {} for missing or corrupt data", () => {
    expect(loadPositions("nobody", "mine")).toEqual({});
    localStorage.setItem(softboardStorageKey("x", "mine"), "not-json");
    expect(loadPositions("x", "mine")).toEqual({});
  });
});

describe("columnsForWidth / defaultPosition", () => {
  it("picks column counts by breakpoints", () => {
    expect(columnsForWidth(400)).toBe(1);
    expect(columnsForWidth(600)).toBe(2);
    expect(columnsForWidth(800)).toBe(3);
    expect(columnsForWidth(1100)).toBe(4);
    expect(columnsForWidth(1400)).toBe(5);
  });

  it("places later indices further down the grid", () => {
    const a = defaultPosition(0, 900);
    const b = defaultPosition(3, 900);
    expect(b.y).toBeGreaterThan(a.y);
  });
});

describe("layoutChronological", () => {
  it("orders newest first and fills left-to-right", () => {
    const pins = [
      pin("old", "2026-01-01T00:00:00.000Z"),
      pin("new", "2026-08-01T00:00:00.000Z"),
      pin("mid", "2026-04-01T00:00:00.000Z"),
    ];
    const map = layoutChronological(pins, 900);
    // 3 columns on ~900px → all on first row; newest = leftmost
    expect(map.new.x).toBeLessThan(map.mid.x);
    expect(map.mid.x).toBeLessThan(map.old.x);
    expect(map.new.y).toBe(map.mid.y);
  });
});

describe("prunePositions", () => {
  it("drops ids that are no longer live", () => {
    const pruned = prunePositions(
      {
        keep: { x: 1, y: 1, rot: 0 },
        gone: { x: 2, y: 2, rot: 0 },
      },
      new Set(["keep"])
    );
    expect(pruned).toEqual({ keep: { x: 1, y: 1, rot: 0 } });
  });
});
