import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  ACCESS_KEY_BYTES,
  SHARE_TOKEN_BYTES,
} from "@note-share/shared";

const BCRYPT_ROUNDS = 12;

/** Opaque URL-safe share token */
export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString("base64url");
}

/**
 * Human-shareable access key (shown once to the owner).
 * URL-safe, no ambiguous characters.
 */
export function generateAccessKey(): string {
  return randomBytes(ACCESS_KEY_BYTES).toString("base64url");
}

export async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifySecret(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
