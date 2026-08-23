import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "../db.js";
import { hashSecret } from "../lib/crypto.js";
import {
  app,
  json,
  createTestUser,
  createTestNote,
  cleanupUser,
} from "../test/helpers.js";

const createdUserIds: string[] = [];

afterEach(async () => {
  while (createdUserIds.length) {
    const id = createdUserIds.pop();
    if (id) await cleanupUser(id);
  }
});

describe("share routes", () => {
  it("increments view count on successful public open", async () => {
    const owner = await createTestUser("owner");
    createdUserIds.push(owner.user.id);
    const note = await createTestNote({
      ownerId: owner.user.id,
      // Avoid near-term expiresAt + timestamp-without-tz skew in claim SQL
      shareType: "TIME_BASED",
      accessType: "PUBLIC",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const open = await json(
      await app.request(`http://test/share/${note.shareToken}/open`, {
        method: "POST",
      })
    );
    expect(open.status).toBe(200);
    expect(open.body.viewCount).toBe(1);

    const refreshed = await prisma.note.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(refreshed.viewCount).toBe(1);
  });

  it("allows only one concurrent one-time open", async () => {
    const owner = await createTestUser("race-owner");
    createdUserIds.push(owner.user.id);
    const note = await createTestNote({
      ownerId: owner.user.id,
      shareType: "ONE_TIME",
      accessType: "PUBLIC",
    });

    const [a, b, c] = await Promise.all([
      app.request(`http://test/share/${note.shareToken}/open`, {
        method: "POST",
      }),
      app.request(`http://test/share/${note.shareToken}/open`, {
        method: "POST",
      }),
      app.request(`http://test/share/${note.shareToken}/open`, {
        method: "POST",
      }),
    ]);

    const results = await Promise.all([json(a), json(b), json(c)]);
    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 410);

    expect(successes).toHaveLength(1);
    expect(conflicts.length).toBeGreaterThanOrEqual(2);
    expect(successes[0]?.body.viewCount).toBe(1);

    const refreshed = await prisma.note.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(refreshed.viewCount).toBe(1);
    expect(refreshed.usedAt).not.toBeNull();
  });

  it("does not increment view count on wrong password", async () => {
    const owner = await createTestUser("pwd-owner");
    createdUserIds.push(owner.user.id);
    const accessKeyHash = await hashSecret("correct-key");
    const note = await createTestNote({
      ownerId: owner.user.id,
      shareType: "TIME_BASED",
      accessType: "PASSWORD",
      accessKeyHash,
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const wrong = await json(
      await app.request(`http://test/share/${note.shareToken}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong-key" }),
      })
    );
    expect(wrong.status).toBe(401);

    const before = await prisma.note.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(before.viewCount).toBe(0);

    const right = await json(
      await app.request(`http://test/share/${note.shareToken}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "correct-key" }),
      })
    );
    expect(right.status).toBe(200);
    expect(right.body.viewCount).toBe(1);
  });

  it("rejects revoked and expired links without claiming a view", async () => {
    const owner = await createTestUser("state-owner");
    createdUserIds.push(owner.user.id);

    const revoked = await createTestNote({
      ownerId: owner.user.id,
      shareType: "TIME_BASED",
      accessType: "PUBLIC",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      revokedAt: new Date(),
    });
    const expired = await createTestNote({
      ownerId: owner.user.id,
      shareType: "TIME_BASED",
      accessType: "PUBLIC",
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    const used = await createTestNote({
      ownerId: owner.user.id,
      shareType: "ONE_TIME",
      accessType: "PUBLIC",
      usedAt: new Date(),
    });

    const revokedRes = await json(
      await app.request(`http://test/share/${revoked.shareToken}/open`, {
        method: "POST",
      })
    );
    const expiredRes = await json(
      await app.request(`http://test/share/${expired.shareToken}/open`, {
        method: "POST",
      })
    );
    const usedRes = await json(
      await app.request(`http://test/share/${used.shareToken}/open`, {
        method: "POST",
      })
    );

    expect(revokedRes.status).toBe(410);
    expect(expiredRes.status).toBe(410);
    expect(usedRes.status).toBe(410);

    for (const id of [revoked.id, expired.id, used.id]) {
      const row = await prisma.note.findUniqueOrThrow({ where: { id } });
      expect(row.viewCount).toBe(0);
    }
  });

  it("enforces RESTRICTED allowlist and skips view count on forbidden open", async () => {
    const owner = await createTestUser("restrict-owner");
    const allowed = await createTestUser("allowed");
    const stranger = await createTestUser("stranger");
    createdUserIds.push(owner.user.id, allowed.user.id, stranger.user.id);

    const note = await createTestNote({
      ownerId: owner.user.id,
      shareType: "TIME_BASED",
      accessType: "RESTRICTED",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      allowedEmails: [allowed.user.email],
    });

    const anon = await json(
      await app.request(`http://test/share/${note.shareToken}/open`, {
        method: "POST",
      })
    );
    expect(anon.status).toBe(401);

    const forbidden = await json(
      await app.request(`http://test/share/${note.shareToken}/open`, {
        method: "POST",
        headers: { Authorization: `Bearer ${stranger.token}` },
      })
    );
    expect(forbidden.status).toBe(403);

    const mid = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
    expect(mid.viewCount).toBe(0);

    const status = await json(
      await app.request(`http://test/share/${note.shareToken}`, {
        headers: { Authorization: `Bearer ${allowed.token}` },
      })
    );
    expect(status.status).toBe(200);
    expect(status.body.requiresAuth).toBe(true);
    expect(status.body.viewerAllowed).toBe(true);

    const ok = await json(
      await app.request(`http://test/share/${note.shareToken}/open`, {
        method: "POST",
        headers: { Authorization: `Bearer ${allowed.token}` },
      })
    );
    expect(ok.status).toBe(200);
    expect(ok.body.viewCount).toBe(1);
  });

  it("GET status does not increment view count", async () => {
    const owner = await createTestUser("status-owner");
    createdUserIds.push(owner.user.id);
    const note = await createTestNote({
      ownerId: owner.user.id,
      shareType: "TIME_BASED",
      accessType: "PUBLIC",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    await app.request(`http://test/share/${note.shareToken}`);
    await app.request(`http://test/share/${note.shareToken}`);

    const refreshed = await prisma.note.findUniqueOrThrow({
      where: { id: note.id },
    });
    expect(refreshed.viewCount).toBe(0);
  });
});
