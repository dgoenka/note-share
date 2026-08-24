import {
  MEDIA_MAX_BYTES_PER_FILE,
  MEDIA_MAX_BYTES_PER_USER,
} from "@note-share/shared";
import { HTTPException } from "hono/http-exception";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { getSupabase, isSupabaseConfigured, mediaBucket } from "./supabase.js";
import { extractMediaIds } from "./sanitize-html.js";

export async function getUserStorageBytes(userId: string): Promise<number> {
  const agg = await prisma.mediaAsset.aggregate({
    where: { ownerId: userId },
    _sum: { byteSize: true },
  });
  return agg._sum.byteSize ?? 0;
}

export function storageLimit(): number {
  return env.MEDIA_MAX_BYTES_PER_USER;
}

export function fileLimit(): number {
  return env.MEDIA_MAX_BYTES_PER_FILE;
}

export async function assertQuota(userId: string, incomingBytes: number) {
  if (incomingBytes > fileLimit()) {
    throw new HTTPException(413, {
      message: `File too large (max ${Math.floor(fileLimit() / (1024 * 1024))} MB after compression)`,
    });
  }
  const used = await getUserStorageBytes(userId);
  if (used + incomingBytes > storageLimit()) {
    throw new HTTPException(413, {
      message: `Storage quota exceeded (${Math.floor(storageLimit() / (1024 * 1024))} MB per user)`,
    });
  }
}

export async function signMediaPaths(
  paths: { id: string; path: string }[]
): Promise<Record<string, string>> {
  if (!paths.length) return {};
  if (!isSupabaseConfigured()) return {};

  const supabase = getSupabase();
  const out: Record<string, string> = {};
  // Sign individually — createSignedUrls needs same-bucket paths array
  const { data, error } = await supabase.storage
    .from(mediaBucket())
    .createSignedUrls(
      paths.map((p) => p.path),
      env.MEDIA_SIGNED_URL_TTL_SEC
    );
  if (error) {
    console.error("[media] sign error", error);
    throw new HTTPException(500, { message: "Could not sign media URLs" });
  }
  for (let i = 0; i < paths.length; i++) {
    const signed = data?.[i]?.signedUrl;
    if (signed && paths[i]) out[paths[i]!.id] = signed;
  }
  return out;
}

export async function mediaUrlsForHtml(
  html: string,
  ownerId?: string
): Promise<Record<string, string>> {
  const ids = extractMediaIds(html);
  if (!ids.length) return {};
  const assets = await prisma.mediaAsset.findMany({
    where: {
      id: { in: ids },
      ...(ownerId ? { ownerId } : {}),
    },
    select: { id: true, path: true },
  });
  return signMediaPaths(assets);
}

export async function attachMediaToNote(
  noteId: string,
  ownerId: string,
  html: string
) {
  const ids = extractMediaIds(html);
  if (!ids.length) return;
  const owned = await prisma.mediaAsset.findMany({
    where: { id: { in: ids }, ownerId },
    select: { id: true },
  });
  if (owned.length !== ids.length) {
    throw new HTTPException(400, {
      message: "Note references media you do not own",
    });
  }
  await prisma.mediaAsset.updateMany({
    where: { id: { in: ids }, ownerId },
    data: { noteId },
  });
}

/** Defaults aligned with shared constants when env omitted */
export { MEDIA_MAX_BYTES_PER_FILE, MEDIA_MAX_BYTES_PER_USER };
