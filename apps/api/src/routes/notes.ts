import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createNoteSchema } from "@note-share/shared";
import type { NoteDetail } from "@note-share/shared";
import { HTTPException } from "hono/http-exception";
import { prisma } from "../db.js";
import { env } from "../env.js";
import {
  generateAccessKey,
  generateShareToken,
  hashSecret,
} from "../lib/crypto.js";
import { attachMediaToNote, mediaUrlsForHtml } from "../lib/media.js";
import { sanitizeNoteHtml } from "../lib/sanitize-html.js";
import { getNoteAccessibility } from "../lib/note-state.js";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";
import type { Note, NoteAllowedEmail } from "@prisma/client";

type NoteWithEmails = Note & { allowedEmails?: NoteAllowedEmail[] };

function toNoteDetail(
  note: NoteWithEmails,
  options?: { accessKey?: string | null; mediaUrls?: Record<string, string> }
): NoteDetail {
  const state = getNoteAccessibility(note);
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    shareType: note.shareType,
    accessType: note.accessType,
    shareToken: note.shareToken,
    shareUrl: `${env.WEB_ORIGIN}/share/${note.shareToken}`,
    accessKey: options?.accessKey ?? null,
    allowedEmails:
      note.accessType === "RESTRICTED"
        ? (note.allowedEmails ?? []).map((e) => e.email)
        : undefined,
    expiresAt: note.expiresAt?.toISOString() ?? null,
    revokedAt: note.revokedAt?.toISOString() ?? null,
    usedAt: note.usedAt?.toISOString() ?? null,
    viewCount: note.viewCount,
    isExpired: state.isExpired,
    isRevoked: state.isRevoked,
    isUsed: state.isUsed,
    isAccessible: state.isAccessible,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    mediaUrls: options?.mediaUrls,
  };
}

const noteInclude = { allowedEmails: { orderBy: { email: "asc" as const } } };

export const notesRoutes = new Hono<{ Variables: AuthVariables }>();

notesRoutes.use("*", requireAuth);

notesRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const notes = await prisma.note.findMany({
    where: { ownerId: userId },
    include: noteInclude,
    orderBy: { createdAt: "desc" },
  });
  return c.json({ notes: notes.map((n) => toNoteDetail(n)) });
});

notesRoutes.post("/", zValidator("json", createNoteSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");

  const shareToken = generateShareToken();
  let accessKey: string | null = null;
  let accessKeyHash: string | null = null;

  if (body.accessType === "PASSWORD") {
    // Server generates the key — never trust a client-supplied secret
    accessKey = generateAccessKey();
    accessKeyHash = await hashSecret(accessKey);
  }

  const expiresAt =
    body.shareType === "TIME_BASED" && body.expiresAt
      ? new Date(body.expiresAt)
      : body.expiresAt
        ? new Date(body.expiresAt)
        : null;

  const uniqueEmails =
    body.accessType === "RESTRICTED"
      ? [...new Set((body.allowedEmails ?? []).map((e) => e.toLowerCase()))]
      : [];

  const content = sanitizeNoteHtml(body.content);
  const textOnly = content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  const { extractMediaIds } = await import("../lib/sanitize-html.js");
  if (!textOnly && extractMediaIds(content).length === 0) {
    throw new HTTPException(400, { message: "Content is required" });
  }

  const note = await prisma.note.create({
    data: {
      title: body.title,
      content,
      shareType: body.shareType,
      accessType: body.accessType,
      shareToken,
      accessKeyHash,
      expiresAt,
      ownerId: userId,
      ...(uniqueEmails.length > 0
        ? {
            allowedEmails: {
              create: uniqueEmails.map((email) => ({ email })),
            },
          }
        : {}),
    },
    include: noteInclude,
  });

  await attachMediaToNote(note.id, userId, content);
  const mediaUrls = await mediaUrlsForHtml(content, userId);

  return c.json(toNoteDetail(note, { accessKey, mediaUrls }), 201);
});

notesRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const note = await prisma.note.findFirst({
    where: { id, ownerId: userId },
    include: noteInclude,
  });
  if (!note) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  const mediaUrls = await mediaUrlsForHtml(note.content, userId);
  // Access key is only returned at creation time (never stored in plain form)
  return c.json(toNoteDetail(note, { mediaUrls }));
});

/**
 * Force-invalidate / revoke the share link.
 * Idempotent: revoking an already-revoked note is fine.
 */
notesRoutes.post("/:id/revoke", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await prisma.note.findFirst({
    where: { id, ownerId: userId },
    include: noteInclude,
  });
  if (!existing) {
    throw new HTTPException(404, { message: "Note not found" });
  }

  const note =
    existing.revokedAt != null
      ? existing
      : await prisma.note.update({
          where: { id: existing.id },
          data: { revokedAt: new Date() },
          include: noteInclude,
        });

  return c.json(toNoteDetail(note));
});
