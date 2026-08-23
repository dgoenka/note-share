import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { env } from "./env.js";

const app = createApp();

// Bind 0.0.0.0 so cloud hosts (Railway/Render) can route traffic in.
console.log(`[api] listening on http://0.0.0.0:${env.PORT}`);
serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" });

export default app;
