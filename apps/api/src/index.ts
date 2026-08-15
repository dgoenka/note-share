import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { notesRoutes } from "./routes/notes.js";
import { shareRoutes } from "./routes/share.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => {
      // Non-browser clients (curl/health checks) may omit Origin
      if (!origin) return env.corsOrigins[0] ?? "http://localhost:3000";
      return env.corsOrigins.includes(origin) ? origin : null;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.get("/health", (c) => c.json({ ok: true, service: "note-share-api" }));

app.route("/auth", authRoutes);
app.route("/notes", notesRoutes);
app.route("/share", shareRoutes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("[api] unhandled error", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

// Bind 0.0.0.0 so cloud hosts (Railway/Render) can route traffic in.
console.log(`[api] listening on http://0.0.0.0:${env.PORT}`);
serve({ fetch: app.fetch, port: env.PORT, hostname: "0.0.0.0" });

export default app;
