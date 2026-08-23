/**
 * Softboard demo recording for NoteShare (corkboard + share security).
 *
 * Usage:
 *   BASE_URL=https://note-share-ruby.vercel.app node scripts/record-demo.mjs
 *   # or local: web :3000 + api :4000
 *   node scripts/record-demo.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = join(process.cwd(), "demo-output");
const email = `demo.video.${Date.now()}@example.com`;
const password = "password123";

mkdirSync(OUT_DIR, { recursive: true });

async function pause(page, ms = 900) {
  await page.waitForTimeout(ms);
}

async function caption(page, text) {
  await page.evaluate((t) => {
    let el = document.getElementById("__demo_caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "__demo_caption";
      Object.assign(el.style, {
        position: "fixed",
        left: "16px",
        right: "16px",
        bottom: "16px",
        zIndex: "999999",
        background: "rgba(55, 35, 20, 0.92)",
        color: "#faf6ef",
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        fontWeight: "600",
        padding: "12px 16px",
        borderRadius: "12px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        pointerEvents: "none",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await pause(page, 1400);
}

async function ensureLoggedIn(page) {
  await page.goto(`${BASE}/`);
  await pause(page, 600);
  const needsAuth =
    (await page.getByRole("link", { name: /login/i }).count()) > 0 ||
    (await page.getByRole("button", { name: /create account|get started|sign in|join/i }).count()) >
      0;
  if (!needsAuth) return;
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(\?|$)/, { timeout: 20000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  // --- Register → softboard ---
  await page.goto(`${BASE}/register`);
  await caption(page, "1) Create an account");
  await page.fill("#name", "Demo Reviewer");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await pause(page, 400);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/(\?|$)/, { timeout: 20000 });
  await caption(page, "Softboard home — Mine / Everyone’s corkboard");
  await pause(page, 1200);

  // --- New note from FAB ---
  await caption(page, "2) Pin a new public note");
  await page.getByRole("button", { name: /new note/i }).click();
  await page.waitForURL(/\/notes\/new/, { timeout: 15000 });
  await page.fill("#title", "Kickoff sticky");
  await page.fill(
    "#content",
    "Hello from the softboard — title-only pins, full content on open."
  );
  await page.getByText("Time-based", { exact: true }).click();
  await page.getByText("Public", { exact: true }).click();
  await pause(page, 500);
  await page.getByRole("button", { name: /create & generate share link/i }).click();
  await page.waitForURL(/\/notes\//, { timeout: 20000 });
  await caption(page, "Share link ready — back to the board");
  const publicLink = await page.locator('a[href*="/share/"]').first().getAttribute("href");
  if (!publicLink) throw new Error("No public share link found");
  await pause(page, 900);

  await page.goto(`${BASE}/`);
  await page.waitForSelector("text=Kickoff sticky", { timeout: 20000 });
  await caption(page, "3) Note appears as a title-only post-it");
  await pause(page, 1000);

  // Arrange
  const arrange = page.getByRole("button", { name: /arrange notes in order/i });
  if (await arrange.count()) {
    await caption(page, "Arrange — chronological tidy-up on desktop");
    await arrange.click();
    await pause(page, 1200);
  }

  // Open post-it dialog
  await caption(page, "4) Open a pin — content loads only then");
  await page.getByText("Kickoff sticky", { exact: true }).click();
  await page.waitForSelector("text=Hello from the softboard", { timeout: 15000 });
  await pause(page, 1500);
  await page.getByRole("button", { name: /^close$/i }).click();
  await pause(page, 600);

  // Everyone’s tab
  await caption(page, "5) Everyone’s — public + allowlisted notes from others");
  const allTab = page.getByRole("tab", { name: /all|everyone/i });
  if (await allTab.count()) {
    await allTab.click();
    await pause(page, 1600);
  }
  const mineTab = page.getByRole("tab", { name: /mine|my notes/i });
  if (await mineTab.count()) await mineTab.click();
  await pause(page, 800);

  // --- Public share open (incognito-style: clear storage via new context page still same video?)
  // Stay on same page for continuous video.
  await page.goto(publicLink.startsWith("http") ? publicLink : `${BASE}${publicLink}`);
  await caption(page, "6) Public share link opens without login");
  await page.waitForSelector("text=Kickoff sticky", { timeout: 15000 });
  await pause(page, 1400);

  // --- One-time security beat ---
  await ensureLoggedIn(page);
  await page.goto(`${BASE}/notes/new`);
  await caption(page, "7) One-time link — security still on the same stack");
  await page.fill("#title", "One-time link");
  await page.fill("#content", "This should only open once.");
  await page.getByText("One-time", { exact: true }).click();
  await page.getByText("Public", { exact: true }).click();
  await page.getByRole("button", { name: /create & generate share link/i }).click();
  await page.waitForURL(/\/notes\//, { timeout: 20000 });
  const oneTimeLink = await page.locator('a[href*="/share/"]').first().getAttribute("href");
  if (!oneTimeLink) throw new Error("No one-time link");
  await pause(page, 800);

  await page.goto(oneTimeLink.startsWith("http") ? oneTimeLink : `${BASE}${oneTimeLink}`);
  await caption(page, "First open succeeds");
  await page.waitForSelector("text=One-time link", { timeout: 15000 });
  await pause(page, 1200);

  await page.goto(oneTimeLink.startsWith("http") ? oneTimeLink : `${BASE}${oneTimeLink}`);
  await caption(page, "Second open fails — already used");
  await page.waitForSelector("text=/already used|unavailable|expired|revoked/i", {
    timeout: 15000,
  });
  await pause(page, 1600);

  // Finale on softboard
  await ensureLoggedIn(page);
  await page.goto(`${BASE}/`);
  await caption(page, "Done — NoteShare softboard");
  await pause(page, 2200);

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();

  const finalPath = join(OUT_DIR, "note-share-softboard-demo.webm");
  if (existsSync(videoPath)) {
    renameSync(videoPath, finalPath);
  }
  console.log(JSON.stringify({ ok: true, video: finalPath, email, base: BASE }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
