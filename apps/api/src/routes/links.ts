import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, type AuthVariables } from "../middleware/auth.js";
import { unfurlLink } from "../lib/link-unfurl.js";
import { checkRateLimit } from "../lib/rate-limit.js";
import { HTTPException } from "hono/http-exception";

const bodySchema = z.object({
  url: z.string().url().max(2048),
});

export const linksRoutes = new Hono<{ Variables: AuthVariables }>();

linksRoutes.use("*", requireAuth);

/** Fetch Open Graph / Twitter card metadata for a URL (link snapshot). */
linksRoutes.post("/unfurl", async (c) => {
  const userId = c.get("userId");
  const limited = checkRateLimit(`unfurl:${userId}`, 30, 60_000);
  if (!limited.allowed) {
    throw new HTTPException(429, {
      message: "Too many link previews — try again shortly",
    });
  }
  const { url } = bodySchema.parse(await c.req.json());
  const preview = await unfurlLink(url);
  return c.json(preview);
});
