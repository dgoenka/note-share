import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for API tests. Use apps/api/.env (local Postgres)."
  );
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-at-least-16-chars";
}

if (!process.env.WEB_ORIGIN) {
  process.env.WEB_ORIGIN = "http://localhost:3000";
}

if (!process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN = "http://localhost:3000";
}
