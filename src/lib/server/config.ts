import "server-only";
import { z } from "zod";
// An unconfigured development checkout can show the empty setup shell, never data.
// Production always requires owner authentication and a complete configuration.
export const isLocalSetup = () =>
  process.env.NODE_ENV === "development" && !configurationStatus().ready;
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  OWNER_EMAIL: z.email(),
  OWNER_GOOGLE_SUB: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "Use a base64-encoded 32-byte key",
    ),
  TOKEN_KEY_VERSION: z.coerce.number().int().positive().default(1),
});
export function configuration() {
  return schema.parse(process.env);
}
export function configurationStatus() {
  const result = schema.safeParse(process.env);
  return {
    ready: result.success,
    missing: result.success
      ? []
      : result.error.issues.map((i) => String(i.path[0])),
  };
}
