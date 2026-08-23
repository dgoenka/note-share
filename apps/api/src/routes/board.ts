import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  BOARD_PAGE_DEFAULT,
  BOARD_PAGE_MAX,
  type BoardPage,
  type BoardPin,
} from "@note-share/shared";
import { prisma } from "../db.js";
import { getNoteAccessibility } from "../lib/note-state.js";
import {
  clampBoardLimit,
  decodeBoardCursor,
  encodeBoardCursor,
} from "../lib/board-cursor.js";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";

type BoardRow = {
  id: string;
  title: string;
  shareToken: string;
  shareType: "ONE_TIME" | "TIME_BASED";
  accessType: "PUBLIC" | "PASSWORD" | "RESTRICTED";
  viewCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  usedAt: Date | null;
  createdAt: Date;
  ownerId: string;
  ownerName: string;
};

function toPin(row: BoardRow, viewerId: string): BoardPin {
  const state = getNoteAccessibility(row);
  return {
    id: row.id,
    title: row.title,
    shareToken: row.shareToken,
    shareType: row.shareType,
    accessType: row.accessType,
    ownerName: row.ownerName,
    isOwner: row.ownerId === viewerId,
    viewCount: row.viewCount,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    usedAt: row.usedAt?.toISOString() ?? null,
    isExpired: state.isExpired,
    isRevoked: state.isRevoked,
    isUsed: state.isUsed,
    isAccessible: state.isAccessible,
    createdAt: row.createdAt.toISOString(),
  };
}

function pageFromRows(
  rows: BoardRow[],
  limit: number,
  viewerId: string
): BoardPage {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  return {
    items: slice.map((r) => toPin(r, viewerId)),
    nextCursor:
      hasMore && last ? encodeBoardCursor(last.createdAt, last.id) : null,
  };
}

export const boardRoutes = new Hono<{ Variables: AuthVariables }>();

boardRoutes.use("*", requireAuth);

/** Own notes — title-only pins, newest first */
boardRoutes.get("/mine", async (c) => {
  const userId = c.get("userId");
  const limit = clampBoardLimit(
    c.req.query("limit"),
    BOARD_PAGE_DEFAULT,
    BOARD_PAGE_MAX
  );
  const cursor = decodeBoardCursor(c.req.query("cursor"));
  if (c.req.query("cursor") && !cursor) {
    throw new HTTPException(400, { message: "Invalid cursor" });
  }

  const notes = await prisma.note.findMany({
    where: {
      ownerId: userId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              {
                AND: [
                  { createdAt: cursor.createdAt },
                  { id: { lt: cursor.id } },
                ],
              },
            ],
          }
        : {}),
    },
    include: { owner: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const mineRows: BoardRow[] = notes.map((n) => ({
    id: n.id,
    title: n.title,
    shareToken: n.shareToken,
    shareType: n.shareType,
    accessType: n.accessType,
    viewCount: n.viewCount,
    expiresAt: n.expiresAt,
    revokedAt: n.revokedAt,
    usedAt: n.usedAt,
    createdAt: n.createdAt,
    ownerId: n.ownerId,
    ownerName: n.owner.name,
  }));

  return c.json(pageFromRows(mineRows, limit, userId));
});

/**
 * Everyone’s feed: PUBLIC notes from others, plus RESTRICTED notes where
 * the viewer’s email is allowlisted. Title-only — no content.
 */
boardRoutes.get("/feed", async (c) => {
  const userId = c.get("userId");
  const userEmail = c.get("userEmail").toLowerCase();
  const limit = clampBoardLimit(
    c.req.query("limit"),
    BOARD_PAGE_DEFAULT,
    BOARD_PAGE_MAX
  );
  const cursor = decodeBoardCursor(c.req.query("cursor"));
  if (c.req.query("cursor") && !cursor) {
    throw new HTTPException(400, { message: "Invalid cursor" });
  }

  const feedRows = cursor
    ? await prisma.$queryRaw<BoardRow[]>`
        SELECT * FROM (
          SELECT
            n.id, n.title, n."shareToken", n."shareType", n."accessType",
            n."viewCount", n."expiresAt", n."revokedAt", n."usedAt", n."createdAt",
            n."ownerId", u.name AS "ownerName"
          FROM notes n
          INNER JOIN users u ON u.id = n."ownerId"
          WHERE n."ownerId" <> ${userId}
            AND n."accessType" = 'PUBLIC'

          UNION ALL

          SELECT
            n.id, n.title, n."shareToken", n."shareType", n."accessType",
            n."viewCount", n."expiresAt", n."revokedAt", n."usedAt", n."createdAt",
            n."ownerId", u.name AS "ownerName"
          FROM notes n
          INNER JOIN users u ON u.id = n."ownerId"
          INNER JOIN note_allowed_emails a ON a."noteId" = n.id
          WHERE n."ownerId" <> ${userId}
            AND n."accessType" = 'RESTRICTED'
            AND a.email = ${userEmail}
        ) AS feed
        WHERE (feed."createdAt", feed.id) < (${cursor.createdAt}, ${cursor.id})
        ORDER BY feed."createdAt" DESC, feed.id DESC
        LIMIT ${limit + 1}
      `
    : await prisma.$queryRaw<BoardRow[]>`
        SELECT * FROM (
          SELECT
            n.id, n.title, n."shareToken", n."shareType", n."accessType",
            n."viewCount", n."expiresAt", n."revokedAt", n."usedAt", n."createdAt",
            n."ownerId", u.name AS "ownerName"
          FROM notes n
          INNER JOIN users u ON u.id = n."ownerId"
          WHERE n."ownerId" <> ${userId}
            AND n."accessType" = 'PUBLIC'

          UNION ALL

          SELECT
            n.id, n.title, n."shareToken", n."shareType", n."accessType",
            n."viewCount", n."expiresAt", n."revokedAt", n."usedAt", n."createdAt",
            n."ownerId", u.name AS "ownerName"
          FROM notes n
          INNER JOIN users u ON u.id = n."ownerId"
          INNER JOIN note_allowed_emails a ON a."noteId" = n.id
          WHERE n."ownerId" <> ${userId}
            AND n."accessType" = 'RESTRICTED'
            AND a.email = ${userEmail}
        ) AS feed
        ORDER BY feed."createdAt" DESC, feed.id DESC
        LIMIT ${limit + 1}
      `;

  return c.json(pageFromRows(feedRows, limit, userId));
});
