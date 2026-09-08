import { z } from "zod";

/**
 * Shared server-side environment schema for apps/api and apps/worker.
 * Fails fast at boot if a required variable is missing/malformed instead
 * of surfacing confusing errors deep in a request path later.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  WEB_URL: z.string().url(),
  API_URL: z.string().url(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_EXPORTS: z.string().min(1),
  S3_BUCKET_IMPORTS: z.string().min(1),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM: z.string().min(1),

  SESSION_COOKIE_SECRET: z.string().min(32, "must be at least 32 chars"),
  CSRF_SECRET: z.string().min(32, "must be at least 32 chars"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(720),
  /**
   * Set this in production when the web app and API live on different
   * subdomains of the same parent (e.g. ".example.com") so the browser will
   * attach/expose cookies to both. Leave unset for local dev — cookies
   * already work across localhost ports without it.
   */
  COOKIE_DOMAIN: z.string().min(1).optional(),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
