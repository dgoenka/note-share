import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { boardRoutes } from "./routes/board.js";
import { linksRoutes } from "./routes/links.js";
import { mediaRoutes } from "./routes/media.js";
import { notesRoutes } from "./routes/notes.js";
import { shareRoutes } from "./routes/share.js";

/** Hono app without binding a port — used by the server entrypoint and tests. */
export function createApp() {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => {
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
  app.route("/media", mediaRoutes);
  app.route("/links", linksRoutes);
  app.route("/board", boardRoutes);
  app.route("/share", shareRoutes);

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    console.error("[api] unhandled error", err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  return app;
}

export type App = ReturnType<typeof createApp>;
