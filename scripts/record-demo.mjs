/**
 * Automated demo recording for the NoteShare POC.
 * Usage: node scripts/record-demo.mjs
 * Requires local web :3000 and API :4000 (or set BASE_URL).
 */
import { chromium } from "playwright";
import { mkdirSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
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
        background: "rgba(30,16,53,0.92)",
        color: "#fff",
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
  await pause(page, 1200);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  // --- Register ---
  await page.goto(`${BASE}/register`);
  await caption(page, "1) Create an account");
  await page.fill("#name", "Demo Reviewer");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await pause(page, 400);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
  await caption(page, "Signed in — ready to create notes");

  // --- Public time-based note ---
  await page.goto(`${BASE}/notes/new`);
  await caption(page, "2) Create a public time-based note");
  await page.fill("#title", "Public kickoff note");
  await page.fill("#content", "Hello reviewers — this is a public share link demo.");
  await page.getByText("Time-based", { exact: true }).click();
  await page.getByText("Public", { exact: true }).click();
  // expiry is prefilled
  await pause(page, 500);
  await page.getByRole("button", { name: /create & generate share link/i }).click();
  await page.waitForURL(/\/notes\//, { timeout: 15000 });
  await caption(page, "Share link generated — copying it");

  const publicLink = await page.locator('a[href*="/share/"]').first().getAttribute("href");
  if (!publicLink) throw new Error("No public share link found");
  await pause(page, 800);

  // Open public in new page (same context = video continues? Actually video is per page)
  // Stay in same page for continuous recording
  await page.goto(publicLink);
  await caption(page, "3) Public share opens without a password");
  await page.waitForSelector("text=Public kickoff note", { timeout: 15000 });
  await pause(page, 1500);

  // Back to app — login again if needed (same origin, localStorage may persist)
  await page.goto(BASE);
  await pause(page, 800);
  // If logged out somehow, login
  if (await page.getByRole("button", { name: /create account|sign in/i }).count()) {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/$/, { timeout: 15000 });
  }

  // --- Password note ---
  await page.goto(`${BASE}/notes/new`);
  await caption(page, "4) Create a password-protected note");
  await page.fill("#title", "Password protected note");
  await page.fill("#content", "Only unlocks with the generated access key.");
  await page.getByText("Time-based", { exact: true }).click();
  await page.getByText("Password-protected", { exact: true }).click();
  await page.getByRole("button", { name: /create & generate share link/i }).click();
  await page.waitForURL(/\/notes\//, { timeout: 15000 });
  await caption(page, "Access key shown once — save it now");

  const keyEl = page.locator("code").first();
  await keyEl.waitFor({ timeout: 10000 });
  const accessKey = (await keyEl.textContent())?.trim();
  const passwordLink = await page.locator('a[href*="/share/"]').first().getAttribute("href");
  if (!accessKey || !passwordLink) throw new Error("Missing password note artifacts");
  await pause(page, 1500);

  await page.goto(passwordLink);
  await caption(page, "5) Wrong password — should fail (no view count bump)");
  await page.fill("#password", "definitely-wrong");
  await page.getByRole("button", { name: /^unlock$/i }).click();
  await pause(page, 1500);

  await caption(page, "6) Correct access key — unlocks successfully");
  await page.fill("#password", accessKey);
  await page.getByRole("button", { name: /^unlock$/i }).click();
  await page.waitForSelector("text=Password protected note", { timeout: 15000 });
  await pause(page, 1500);

  // --- One-time ---
  await page.goto(BASE);
  if (await page.locator('a[href="/login"]').count()) {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/$/, { timeout: 15000 });
  }

  await page.goto(`${BASE}/notes/new`);
  await caption(page, "7) Create a one-time public note");
  await page.fill("#title", "One-time link");
  await page.fill("#content", "This should only open once.");
  await page.getByText("One-time", { exact: true }).click();
  await page.getByText("Public", { exact: true }).click();
  await page.getByRole("button", { name: /create & generate share link/i }).click();
  await page.waitForURL(/\/notes\//, { timeout: 15000 });
  const oneTimeLink = await page.locator('a[href*="/share/"]').first().getAttribute("href");
  if (!oneTimeLink) throw new Error("No one-time link");

  await page.goto(oneTimeLink);
  await caption(page, "First open succeeds");
  await page.waitForSelector("text=One-time link", { timeout: 15000 });
  await pause(page, 1200);

  await page.goto(oneTimeLink);
  await caption(page, "Second open fails — already used");
  await page.waitForSelector("text=/already used|unavailable/i", { timeout: 15000 });
  await pause(page, 1500);

  // --- Revoke ---
  await page.goto(BASE);
  if (await page.locator('a[href="/login"]').count()) {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/$/, { timeout: 15000 });
  }

  await page.goto(`${BASE}/notes/new`);
  await caption(page, "8) Force invalidate / revoke");
  await page.fill("#title", "Will be revoked");
  await page.fill("#content", "This link will be force-invalidated.");
  await page.getByText("Time-based", { exact: true }).click();
  await page.getByText("Public", { exact: true }).click();
  await page.getByRole("button", { name: /create & generate share link/i }).click();
  await page.waitForURL(/\/notes\//, { timeout: 15000 });
  const revokeLink = await page.locator('a[href*="/share/"]').first().getAttribute("href");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /force invalidate|revoke/i }).click();
  await caption(page, "Share link revoked by owner");
  await pause(page, 1000);

  await page.goto(revokeLink);
  await caption(page, "Revoked link is unavailable");
  await page.waitForSelector("text=/revoked|unavailable/i", { timeout: 15000 });
  await pause(page, 1800);

  await page.goto(BASE);
  await caption(page, "Done — NoteShare POC demo");
  await pause(page, 2000);

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();

  const finalPath = join(OUT_DIR, "note-share-demo.webm");
  if (existsSync(videoPath)) {
    renameSync(videoPath, finalPath);
  }
  console.log(JSON.stringify({ ok: true, video: finalPath, email }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
