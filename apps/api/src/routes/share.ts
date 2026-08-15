import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { unlockShareSchema } from "@note-share/shared";
import type { ShareStatus, SharedNoteView } from "@note-share/shared";
import { HTTPException } from "hono/http-exception";
import { prisma } from "../db.js";
import { verifySecret } from "../lib/crypto.js";
import { getNoteAccessibility } from "../lib/note-state.js";
import { checkRateLimit } from "../lib/rate-limit.js";
import type { Note } from "@prisma/client";

export const shareRoutes = new Hono();

function toSharedView(note: Note): SharedNoteView {
  return {
    title: note.title,
    content: note.content,
    shareType: note.shareType,
    accessType: note.accessType,
    expiresAt: note.expiresAt?.toISOString() ?? null,
    viewCount: note.viewCount,
  };
}

function statusFromNote(note: Note | null): ShareStatus {
  if (!note) {
    return { valid: false, requiresPassword: false, reason: "NOT_FOUND" };
  }
  const state = getNoteAccessibility(note);
  if (!state.isAccessible) {
    return {
      valid: false,
      requiresPassword: false,
      reason: state.reason,
      title: note.title,
      shareType: note.shareType,
      accessType: note.accessType,
      expiresAt: note.expiresAt?.toISOString() ?? null,
    };
  }
  return {
    valid: true,
    requiresPassword: note.accessType === "PASSWORD",
    reason: "OK",
    title: note.title,
    shareType: note.shareType,
    accessType: note.accessType,
    expiresAt: note.expiresAt?.toISOString() ?? null,
  };
}

/**
 * Atomically claim a successful view.
 *
 * Race-condition strategy for ONE_TIME:
 *   UPDATE notes
 *   SET used_at = now(), view_count = view_count + 1
 *   WHERE id = $id
 *     AND revoked_at IS NULL
 *     AND used_at IS NULL
 *     AND (expires_at IS NULL OR expires_at > now())
 *   RETURNING *
 *
 * Only one concurrent request can win the `used_at IS NULL` check.
 * Losers get 0 rows → treat as ALREADY_USED.
 *
 * For TIME_BASED / PUBLIC (non one-time):
 *   same WHERE guards minus used_at, only increments view_count.
 */
async function claimSuccessfulView(noteId: string): Promise<Note | null> {
  // Use DB clock (NOW()) so timestamp-without-tz columns stay consistent with Prisma writes.
  // Conditional UPDATE is the race-safe claim: only one concurrent ONE_TIME winner.
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Note[]>`
      UPDATE notes
      SET
        "viewCount" = "viewCount" + 1,
        "usedAt" = CASE
          WHEN "shareType" = 'ONE_TIME' THEN NOW()
          ELSE "usedAt"
        END,
        "updatedAt" = NOW()
      WHERE id = ${noteId}
        AND "revokedAt" IS NULL
        AND ("usedAt" IS NULL OR "shareType" <> 'ONE_TIME')
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      RETURNING
        id,
        title,
        content,
        "shareType",
        "accessType",
        "shareToken",
        "accessKeyHash",
        "expiresAt",
        "revokedAt",
        "usedAt",
        "viewCount",
        "ownerId",
        "createdAt",
        "updatedAt"
    `;
    return rows[0] ?? null;
  });
}

/** GET /share/:token — status only, does NOT increment view count */
shareRoutes.get("/:token", async (c) => {
  const token = c.req.param("token");
  const note = await prisma.note.findUnique({ where: { shareToken: token } });
  return c.json(statusFromNote(note));
});

/**
 * POST /share/:token/open — open a PUBLIC share (or unlock after password already verified client-side path).
 * For PASSWORD notes, use /unlock instead.
 */
shareRoutes.post("/:token/open", async (c) => {
  const token = c.req.param("token");
  const note = await prisma.note.findUnique({ where: { shareToken: token } });

  if (!note) {
    throw new HTTPException(404, { message: "Share link not found" });
  }

  const state = getNoteAccessibility(note);
  if (!state.isAccessible) {
    throw new HTTPException(410, {
      message:
        state.reason === "REVOKED"
          ? "This share link has been revoked"
          : state.reason === "ALREADY_USED"
            ? "This one-time link has already been used"
            : "This share link has expired",
    });
  }

  if (note.accessType === "PASSWORD") {
    throw new HTTPException(401, {
      message: "Password required — use POST /share/:token/unlock",
    });
  }

  const claimed = await claimSuccessfulView(note.id);
  if (!claimed) {
    // Lost the race (one-time) or became invalid mid-flight
    const refreshed = await prisma.note.findUnique({ where: { id: note.id } });
    const refreshedState = refreshed
      ? getNoteAccessibility(refreshed)
      : { reason: "NOT_FOUND" as const };
    throw new HTTPException(410, {
      message:
        refreshedState.reason === "ALREADY_USED"
          ? "This one-time link has already been used"
          : refreshedState.reason === "REVOKED"
            ? "This share link has been revoked"
            : "This share link is no longer available",
    });
  }

  return c.json(toSharedView(claimed));
});

/**
 * POST /share/:token/unlock — password-protected open.
 * Wrong password does NOT increment view count.
 * Rate-limited per token+IP to mitigate brute force.
 */
shareRoutes.post(
  "/:token/unlock",
  zValidator("json", unlockShareSchema),
  async (c) => {
    const token = c.req.param("token");
    const { password } = c.req.valid("json");
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";

    // 10 attempts / 15 minutes per token+IP
    const limit = checkRateLimit(`unlock:${token}:${ip}`, 10, 15 * 60_000);
    if (!limit.allowed) {
      c.header(
        "Retry-After",
        String(Math.ceil(limit.retryAfterMs / 1000))
      );
      throw new HTTPException(429, {
        message: "Too many unlock attempts. Please try again later.",
      });
    }

    const note = await prisma.note.findUnique({ where: { shareToken: token } });
    if (!note) {
      throw new HTTPException(404, { message: "Share link not found" });
    }

    const state = getNoteAccessibility(note);
    if (!state.isAccessible) {
      throw new HTTPException(410, {
        message:
          state.reason === "REVOKED"
            ? "This share link has been revoked"
            : state.reason === "ALREADY_USED"
              ? "This one-time link has already been used"
              : "This share link has expired",
      });
    }

    if (note.accessType !== "PASSWORD" || !note.accessKeyHash) {
      throw new HTTPException(400, {
        message: "This share link is not password-protected",
      });
    }

    const ok = await verifySecret(password, note.accessKeyHash);
    if (!ok) {
      // Wrong password → no view count increase
      throw new HTTPException(401, { message: "Incorrect password" });
    }

    const claimed = await claimSuccessfulView(note.id);
    if (!claimed) {
      throw new HTTPException(410, {
        message: "This one-time link has already been used",
      });
    }

    return c.json(toSharedView(claimed));
  }
);

