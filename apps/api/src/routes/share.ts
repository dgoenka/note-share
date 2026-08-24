import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { unlockShareSchema } from "@note-share/shared";
import type { ShareStatus, SharedNoteView } from "@note-share/shared";
import { HTTPException } from "hono/http-exception";
import { prisma } from "../db.js";
import { verifySecret } from "../lib/crypto.js";
import { mediaUrlsForHtml } from "../lib/media.js";
import { getNoteAccessibility } from "../lib/note-state.js";
import { checkRateLimit } from "../lib/rate-limit.js";
import { optionalAuth, type OptionalAuthVariables } from "../middleware/auth.js";
import type { Note } from "@prisma/client";

export const shareRoutes = new Hono<{ Variables: OptionalAuthVariables }>();

async function toSharedView(note: Note): Promise<SharedNoteView> {
  const mediaUrls = await mediaUrlsForHtml(note.content);
  return {
    title: note.title,
    content: note.content,
    shareType: note.shareType,
    accessType: note.accessType,
    expiresAt: note.expiresAt?.toISOString() ?? null,
    viewCount: note.viewCount,
    mediaUrls,
  };
}

function baseStatus(
  note: Note | null,
  extras?: Partial<ShareStatus>
): ShareStatus {
  if (!note) {
    return { valid: false, requiresPassword: false, reason: "NOT_FOUND" };
  }
  const state = getNoteAccessibility(note);
  if (!state.isAccessible) {
    return {
      valid: false,
      requiresPassword: false,
      requiresAuth: note.accessType === "RESTRICTED",
      reason: state.reason,
      title: note.title,
      shareType: note.shareType,
      accessType: note.accessType,
      expiresAt: note.expiresAt?.toISOString() ?? null,
      ...extras,
    };
  }
  return {
    valid: true,
    requiresPassword: note.accessType === "PASSWORD",
    requiresAuth: note.accessType === "RESTRICTED",
    reason: "OK",
    title: note.title,
    shareType: note.shareType,
    accessType: note.accessType,
    expiresAt: note.expiresAt?.toISOString() ?? null,
    ...extras,
  };
}

/**
 * Atomically claim a successful view (race-safe for ONE_TIME).
 */
async function claimSuccessfulView(noteId: string): Promise<Note | null> {
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

async function isEmailAllowed(noteId: string, email: string): Promise<boolean> {
  const row = await prisma.noteAllowedEmail.findUnique({
    where: {
      noteId_email: { noteId, email: email.toLowerCase() },
    },
    select: { id: true },
  });
  return row != null;
}

function unavailableMessage(reason: string): string {
  if (reason === "REVOKED") return "This share link has been revoked";
  if (reason === "ALREADY_USED")
    return "This one-time link has already been used";
  if (reason === "EXPIRED") return "This share link has expired";
  return "This share link is no longer available";
}

/** GET /share/:token — status only, does NOT increment view count */
shareRoutes.get(
  "/:token",
  optionalAuth,
  async (c) => {
    const token = c.req.param("token");
    const note = await prisma.note.findUnique({ where: { shareToken: token } });
    const viewerEmail = c.get("userEmail");

    let viewerAllowed: boolean | null | undefined;
    if (note?.accessType === "RESTRICTED") {
      if (viewerEmail) {
        viewerAllowed = await isEmailAllowed(note.id, viewerEmail);
      } else {
        viewerAllowed = null;
      }
    }

    return c.json(baseStatus(note, { viewerAllowed }));
  }
);

/**
 * POST /share/:token/open — PUBLIC open, or RESTRICTED open (auth required).
 * PASSWORD notes must use /unlock.
 */
shareRoutes.post("/:token/open", optionalAuth, async (c) => {
  const token = c.req.param("token");
  const note = await prisma.note.findUnique({ where: { shareToken: token } });

  if (!note) {
    throw new HTTPException(404, { message: "Share link not found" });
  }

  const state = getNoteAccessibility(note);
  if (!state.isAccessible) {
    throw new HTTPException(410, { message: unavailableMessage(state.reason) });
  }

  if (note.accessType === "PASSWORD") {
    throw new HTTPException(401, {
      message: "Password required — use POST /share/:token/unlock",
    });
  }

  if (note.accessType === "RESTRICTED") {
    const userId = c.get("userId");
    const userEmail = c.get("userEmail");
    if (!userId || !userEmail) {
      throw new HTTPException(401, {
        message: "Sign in to open this restricted share link",
      });
    }
    const allowed = await isEmailAllowed(note.id, userEmail);
    if (!allowed) {
      // Do not increment view count
      throw new HTTPException(403, {
        message: "Your account is not on the allowlist for this note",
      });
    }
  }

  const claimed = await claimSuccessfulView(note.id);
  if (!claimed) {
    const refreshed = await prisma.note.findUnique({ where: { id: note.id } });
    const refreshedState = refreshed
      ? getNoteAccessibility(refreshed)
      : { reason: "NOT_FOUND" as const };
    throw new HTTPException(410, {
      message: unavailableMessage(refreshedState.reason),
    });
  }

  return c.json(await toSharedView(claimed));
});

/**
 * POST /share/:token/unlock — password-protected open.
 * Wrong password does NOT increment view count.
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

    const limit = checkRateLimit(`unlock:${token}:${ip}`, 10, 15 * 60_000);
    if (!limit.allowed) {
      c.header("Retry-After", String(Math.ceil(limit.retryAfterMs / 1000)));
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
        message: unavailableMessage(state.reason),
      });
    }

    if (note.accessType !== "PASSWORD" || !note.accessKeyHash) {
      throw new HTTPException(400, {
        message: "This share link is not password-protected",
      });
    }

    const ok = await verifySecret(password, note.accessKeyHash);
    if (!ok) {
      throw new HTTPException(401, { message: "Incorrect password" });
    }

    const claimed = await claimSuccessfulView(note.id);
    if (!claimed) {
      throw new HTTPException(410, {
        message: "This one-time link has already been used",
      });
    }

    return c.json(await toSharedView(claimed));
  }
);
