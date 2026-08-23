import { z } from "zod";
import {
  ACCESS_TYPES,
  ALLOWED_EMAILS_MAX,
  EMAIL_MAX,
  NAME_MAX,
  NOTE_CONTENT_MAX,
  NOTE_TITLE_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  SHARE_TYPES,
} from "./constants.js";

export const shareTypeSchema = z.enum(SHARE_TYPES);
export const accessTypeSchema = z.enum(ACCESS_TYPES);

const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .max(EMAIL_MAX)
  .transform((e) => e.toLowerCase());

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`),
  email: emailSchema,
  password: z
    .string()
    .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(PASSWORD_MAX),
});

/**
 * Create-note payload.
 * - TIME_BASED requires expiresAt in the future.
 * - ONE_TIME may omit expiresAt (or still allow a hard expiry as defence-in-depth).
 * - PASSWORD access: server generates the key; client must not send one.
 * - RESTRICTED access: requires allowedEmails (1…ALLOWED_EMAILS_MAX), normalized lowercase.
 */
export const createNoteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(NOTE_TITLE_MAX, `Title must be at most ${NOTE_TITLE_MAX} characters`),
    content: z
      .string()
      .trim()
      .min(1, "Content is required")
      .max(
        NOTE_CONTENT_MAX,
        `Content must be at most ${NOTE_CONTENT_MAX} characters`
      ),
    shareType: shareTypeSchema,
    accessType: accessTypeSchema,
    /** ISO 8601 datetime string. Required for TIME_BASED. */
    expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
    /** Required when accessType is RESTRICTED. Ignored otherwise. */
    allowedEmails: z.array(emailSchema).max(ALLOWED_EMAILS_MAX).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.shareType === "TIME_BASED") {
      if (!data.expiresAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expiry date/time is required for time-based shares",
          path: ["expiresAt"],
        });
      } else {
        const expiry = new Date(data.expiresAt);
        if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Expiry must be a valid date/time in the future",
            path: ["expiresAt"],
          });
        }
      }
    }

    if (data.accessType === "RESTRICTED") {
      const emails = data.allowedEmails ?? [];
      if (emails.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Add at least one email for restricted access",
          path: ["allowedEmails"],
        });
      } else {
        const unique = new Set(emails);
        if (unique.size !== emails.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Duplicate emails are not allowed",
            path: ["allowedEmails"],
          });
        }
      }
    }
  });

export const unlockShareSchema = z.object({
  password: z
    .string()
    .min(1, "Password is required")
    .max(PASSWORD_MAX),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UnlockShareInput = z.infer<typeof unlockShareSchema>;
