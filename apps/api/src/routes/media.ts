import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { MediaUploadResponse } from "@note-share/shared";
import { prisma } from "../db.js";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";
import {
  assertQuota,
  fileLimit,
  getUserStorageBytes,
  signMediaPaths,
  storageLimit,
} from "../lib/media.js";
import { getSupabase, isSupabaseConfigured, mediaBucket } from "../lib/supabase.js";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

function extFor(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    default:
      return "bin";
  }
}

export const mediaRoutes = new Hono<{ Variables: AuthVariables }>();

mediaRoutes.use("*", requireAuth);

mediaRoutes.get("/quota", async (c) => {
  const userId = c.get("userId");
  const used = await getUserStorageBytes(userId);
  return c.json({
    storageBytesUsed: used,
    storageBytesLimit: storageLimit(),
  });
});

mediaRoutes.post("/upload", async (c) => {
  if (!isSupabaseConfigured()) {
    throw new HTTPException(503, {
      message:
        "Media uploads are not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const userId = c.get("userId");
  const body = await c.req.parseBody({ all: true });
  const file = body["file"];
  if (!file || !(file instanceof File)) {
    throw new HTTPException(400, { message: "Expected multipart field `file`" });
  }

  const mime = file.type || "application/octet-stream";
  let kind: "IMAGE" | "VIDEO";
  if (IMAGE_TYPES.has(mime)) kind = "IMAGE";
  else if (VIDEO_TYPES.has(mime)) kind = "VIDEO";
  else {
    throw new HTTPException(415, {
      message: "Unsupported type. Use JPEG/PNG/WebP/GIF or MP4/WebM.",
    });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  await assertQuota(userId, buf.byteLength);

  const asset = await prisma.mediaAsset.create({
    data: {
      ownerId: userId,
      path: "pending",
      mimeType: mime,
      byteSize: buf.byteLength,
      kind,
    },
  });

  const path = `${userId}/${asset.id}.${extFor(mime)}`;
  const supabase = getSupabase();
  const { error } = await supabase.storage
    .from(mediaBucket())
    .upload(path, buf, { contentType: mime, upsert: false });

  if (error) {
    await prisma.mediaAsset.delete({ where: { id: asset.id } }).catch(() => {});
    console.error("[media] upload failed", error);
    throw new HTTPException(500, { message: "Upload to storage failed" });
  }

  const updated = await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: { path },
  });

  const response: MediaUploadResponse = {
    id: updated.id,
    path: updated.path,
    mimeType: updated.mimeType,
    byteSize: updated.byteSize,
    kind: updated.kind,
  };
  return c.json(response, 201);
});

const signSchema = z.object({
  ids: z.array(z.string().min(1)).max(50),
});

mediaRoutes.post("/sign", async (c) => {
  const userId = c.get("userId");
  const body = signSchema.parse(await c.req.json());
  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: body.ids }, ownerId: userId },
    select: { id: true, path: true },
  });
  const urls = await signMediaPaths(assets);
  return c.json({ urls });
});

mediaRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const asset = await prisma.mediaAsset.findFirst({
    where: { id, ownerId: userId },
  });
  if (!asset) throw new HTTPException(404, { message: "Media not found" });
  if (asset.noteId) {
    throw new HTTPException(409, {
      message: "Media is attached to a note and cannot be deleted here",
    });
  }

  if (isSupabaseConfigured() && asset.path !== "pending") {
    await getSupabase().storage.from(mediaBucket()).remove([asset.path]);
  }
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  return c.json({ ok: true });
});

/** For tests / docs */
export const mediaLimits = { fileLimit, storageLimit };
