import type { Note } from "@prisma/client";

export type NoteAccessibility = {
  isExpired: boolean;
  isRevoked: boolean;
  isUsed: boolean;
  isAccessible: boolean;
  reason: "OK" | "REVOKED" | "EXPIRED" | "ALREADY_USED";
};

/**
 * Pure helper: compute whether a note share link can be opened right now.
 * Does not touch the DB — used by status endpoint and owner views.
 */
export function getNoteAccessibility(
  note: Pick<
    Note,
    "shareType" | "expiresAt" | "revokedAt" | "usedAt"
  >,
  now: Date = new Date()
): NoteAccessibility {
  const isRevoked = note.revokedAt != null;
  if (isRevoked) {
    return {
      isExpired: false,
      isRevoked: true,
      isUsed: note.usedAt != null,
      isAccessible: false,
      reason: "REVOKED",
    };
  }

  const isUsed = note.shareType === "ONE_TIME" && note.usedAt != null;
  if (isUsed) {
    return {
      isExpired: false,
      isRevoked: false,
      isUsed: true,
      isAccessible: false,
      reason: "ALREADY_USED",
    };
  }

  const isExpired =
    note.expiresAt != null && note.expiresAt.getTime() <= now.getTime();
  if (isExpired) {
    return {
      isExpired: true,
      isRevoked: false,
      isUsed: false,
      isAccessible: false,
      reason: "EXPIRED",
    };
  }

  return {
    isExpired: false,
    isRevoked: false,
    isUsed: false,
    isAccessible: true,
    reason: "OK",
  };
}
