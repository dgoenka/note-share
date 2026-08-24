import "dotenv/config";
import { z } from "zod";
import {
  MEDIA_MAX_BYTES_PER_FILE,
  MEDIA_MAX_BYTES_PER_USER,
} from "@note-share/shared";

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
  /** Supabase (optional until media uploads are used) */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  MEDIA_BUCKET: z.string().default("note-media"),
  MEDIA_MAX_BYTES_PER_FILE: z.coerce
    .number()
    .int()
    .positive()
    .default(MEDIA_MAX_BYTES_PER_FILE),
  MEDIA_MAX_BYTES_PER_USER: z.coerce
    .number()
    .int()
    .positive()
    .default(MEDIA_MAX_BYTES_PER_USER),
  MEDIA_SIGNED_URL_TTL_SEC: z.coerce.number().int().positive().default(3600),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  corsOrigins: parsed.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
