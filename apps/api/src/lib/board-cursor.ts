export type BoardCursor = {
  createdAt: Date;
  id: string;
};

/** Encode keyset cursor as URL-safe base64 JSON */
export function encodeBoardCursor(createdAt: Date, id: string): string {
  const payload = JSON.stringify({
    t: createdAt.toISOString(),
    id,
  });
  return Buffer.from(payload, "utf8").toString("base64url");
}

export function decodeBoardCursor(raw: string | undefined | null): BoardCursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { t?: string; id?: string };
    if (!parsed.t || !parsed.id) return null;
    const createdAt = new Date(parsed.t);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function clampBoardLimit(raw: string | undefined, fallback: number, max: number) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}
