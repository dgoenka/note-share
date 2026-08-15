import type { AccessType, ShareType } from "./constants.js";

/** Public user shape returned by auth endpoints (never includes password hash) */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

/** Owner-facing note detail (includes share metadata + access key once) */
export interface NoteDetail {
  id: string;
  title: string;
  content: string;
  shareType: ShareType;
  accessType: AccessType;
  shareToken: string;
  shareUrl: string;
  /** Plain access key — only present at creation time for PASSWORD notes */
  accessKey?: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  usedAt: string | null;
  viewCount: number;
  isExpired: boolean;
  isRevoked: boolean;
  isUsed: boolean;
  isAccessible: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Payload returned when a share link is successfully opened */
export interface SharedNoteView {
  title: string;
  content: string;
  shareType: ShareType;
  accessType: AccessType;
  expiresAt: string | null;
  viewCount: number;
}

/**
 * Pre-unlock status for a share token.
 * Never leaks note content or whether a password is "almost right".
 */
export interface ShareStatus {
  valid: boolean;
  requiresPassword: boolean;
  reason?:
    | "NOT_FOUND"
    | "REVOKED"
    | "EXPIRED"
    | "ALREADY_USED"
    | "OK";
  title?: string;
  shareType?: ShareType;
  accessType?: AccessType;
  expiresAt?: string | null;
}

export interface AuthResponse {
  user: PublicUser;
  token: string;
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}
