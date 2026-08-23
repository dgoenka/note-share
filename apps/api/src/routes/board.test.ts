import { describe, it, expect, afterEach } from "vitest";
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

describe("board routes", () => {
  it("mine returns only own title-only pins", async () => {
    const a = await createTestUser("board-a");
    const b = await createTestUser("board-b");
    createdUserIds.push(a.user.id, b.user.id);

    await createTestNote({
      ownerId: a.user.id,
      title: "A public",
      accessType: "PUBLIC",
      shareType: "TIME_BASED",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    await createTestNote({
      ownerId: b.user.id,
      title: "B public",
      accessType: "PUBLIC",
      shareType: "TIME_BASED",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const res = await json(
      await app.request("http://test/board/mine?limit=10", {
        headers: { Authorization: `Bearer ${a.token}` },
      })
    );
    expect(res.status).toBe(200);
    const items = res.body.items as Array<Record<string, unknown>>;
    expect(items.every((i) => i.isOwner === true)).toBe(true);
    expect(items.some((i) => i.title === "A public")).toBe(true);
    expect(items.some((i) => i.title === "B public")).toBe(false);
    expect(items.every((i) => i.content === undefined)).toBe(true);
  });

  it("feed returns public + allowlisted restricted, excludes own", async () => {
    const me = await createTestUser("board-me");
    const other = await createTestUser("board-other");
    createdUserIds.push(me.user.id, other.user.id);

    await createTestNote({
      ownerId: me.user.id,
      title: "My public",
      accessType: "PUBLIC",
      shareType: "TIME_BASED",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    await createTestNote({
      ownerId: other.user.id,
      title: "Their public",
      accessType: "PUBLIC",
      shareType: "TIME_BASED",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    await createTestNote({
      ownerId: other.user.id,
      title: "For me",
      accessType: "RESTRICTED",
      shareType: "TIME_BASED",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      allowedEmails: [me.user.email],
    });
    await createTestNote({
      ownerId: other.user.id,
      title: "Secret password",
      accessType: "PASSWORD",
      shareType: "TIME_BASED",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      accessKeyHash: "x",
    });
    await createTestNote({
      ownerId: other.user.id,
      title: "Not for me",
      accessType: "RESTRICTED",
      shareType: "TIME_BASED",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      allowedEmails: ["someoneelse@example.com"],
    });

    const res = await json(
      await app.request("http://test/board/feed?limit=20", {
        headers: { Authorization: `Bearer ${me.token}` },
      })
    );
    expect(res.status).toBe(200);
    const items = res.body.items as Array<Record<string, unknown>>;
    const titles = items.map((i) => i.title);
    expect(titles).toContain("Their public");
    expect(titles).toContain("For me");
    expect(titles).not.toContain("My public");
    expect(titles).not.toContain("Secret password");
    expect(titles).not.toContain("Not for me");
    expect(items.every((i) => i.content === undefined)).toBe(true);
  });

  it("supports cursor pagination on mine", async () => {
    const u = await createTestUser("board-page");
    createdUserIds.push(u.user.id);
    for (let i = 0; i < 5; i++) {
      await createTestNote({
        ownerId: u.user.id,
        title: `N${i}`,
        accessType: "PUBLIC",
        shareType: "ONE_TIME",
      });
    }

    const page1 = await json(
      await app.request("http://test/board/mine?limit=2", {
        headers: { Authorization: `Bearer ${u.token}` },
      })
    );
    expect(page1.status).toBe(200);
    expect((page1.body.items as unknown[]).length).toBe(2);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await json(
      await app.request(
        `http://test/board/mine?limit=2&cursor=${encodeURIComponent(String(page1.body.nextCursor))}`,
        { headers: { Authorization: `Bearer ${u.token}` } }
      )
    );
    expect(page2.status).toBe(200);
    expect((page2.body.items as unknown[]).length).toBe(2);
    const ids1 = (page1.body.items as Array<{ id: string }>).map((i) => i.id);
    const ids2 = (page2.body.items as Array<{ id: string }>).map((i) => i.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });
});
