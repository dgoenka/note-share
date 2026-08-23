import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { hashSecret } from "../lib/crypto.js";
import { signToken } from "../lib/jwt.js";
import type { AccessType, ShareType } from "@prisma/client";

export const app = createApp();

export async function json(
  res: Response
): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

export async function createTestUser(prefix = "test") {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${prefix}-${suffix}@example.com`.toLowerCase();
  const passwordHash = await hashSecret("password123");
  const user = await prisma.user.create({
    data: {
      name: `User ${prefix}`,
      email,
      passwordHash,
    },
  });
  const token = await signToken({ sub: user.id, email: user.email });
  return { user, token };
}

export async function createTestNote(options: {
  ownerId: string;
  shareType?: ShareType;
  accessType?: AccessType;
  accessKeyHash?: string | null;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  usedAt?: Date | null;
  allowedEmails?: string[];
  title?: string;
}) {
  const shareToken = `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const note = await prisma.note.create({
    data: {
      title: options.title ?? "Test note",
      content: "secret content",
      shareType: options.shareType ?? "ONE_TIME",
      accessType: options.accessType ?? "PUBLIC",
      shareToken,
      accessKeyHash: options.accessKeyHash ?? null,
      expiresAt: options.expiresAt ?? null,
      revokedAt: options.revokedAt ?? null,
      usedAt: options.usedAt ?? null,
      ownerId: options.ownerId,
      ...(options.allowedEmails?.length
        ? {
            allowedEmails: {
              create: options.allowedEmails.map((email) => ({
                email: email.toLowerCase(),
              })),
            },
          }
        : {}),
    },
  });
  return note;
}

export async function cleanupUser(userId: string) {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}
