import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  /** Public frontend origin — used to build share URLs */
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().int().positive().default(4000),
  /**
   * CORS allowlist. Comma-separated origins are supported so preview + prod
   * Vercel URLs can both call the API.
   */
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  corsOrigins: parsed.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
