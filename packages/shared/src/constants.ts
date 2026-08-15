/** Share type: how the link expires / can be used */
export const SHARE_TYPES = ["ONE_TIME", "TIME_BASED"] as const;
export type ShareType = (typeof SHARE_TYPES)[number];

/** Access type: whether a password is required to open the link */
export const ACCESS_TYPES = ["PUBLIC", "PASSWORD"] as const;
export type AccessType = (typeof ACCESS_TYPES)[number];

export const NOTE_TITLE_MAX = 200;
export const NOTE_CONTENT_MAX = 50_000;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const EMAIL_MAX = 255;
export const NAME_MAX = 100;

/** Length of the cryptographically random share token (bytes before base64url) */
export const SHARE_TOKEN_BYTES = 32;

/** Length of the auto-generated access key shown once at note creation */
export const ACCESS_KEY_BYTES = 12;
