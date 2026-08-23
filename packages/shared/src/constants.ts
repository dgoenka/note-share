/** Share type: how the link expires / can be used */
export const SHARE_TYPES = ["ONE_TIME", "TIME_BASED"] as const;
export type ShareType = (typeof SHARE_TYPES)[number];

/**
 * Access type:
 * - PUBLIC — anyone with the link
 * - PASSWORD — link + server-generated access key
 * - RESTRICTED — link + logged-in user whose email is on the allowlist (stretch)
 */
export const ACCESS_TYPES = ["PUBLIC", "PASSWORD", "RESTRICTED"] as const;
export type AccessType = (typeof ACCESS_TYPES)[number];

export const NOTE_TITLE_MAX = 200;
export const NOTE_CONTENT_MAX = 50_000;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const EMAIL_MAX = 255;
export const NAME_MAX = 100;
/** Max emails on a RESTRICTED note allowlist */
export const ALLOWED_EMAILS_MAX = 25;

/** Softboard page size defaults */
export const BOARD_PAGE_DEFAULT = 24;
export const BOARD_PAGE_MAX = 50;

/** Length of the cryptographically random share token (bytes before base64url) */
export const SHARE_TOKEN_BYTES = 32;

/** Length of the auto-generated access key shown once at note creation */
export const ACCESS_KEY_BYTES = 12;
