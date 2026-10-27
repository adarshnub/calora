import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const randomSecret = () => randomBytes(32).toString("base64url");
export function encrypt(value: unknown, context: string) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "base64");
  if (key.length !== 32) throw new Error("INVALID_ENCRYPTION_KEY");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    process.env.TOKEN_KEY_VERSION ?? "1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}
export function decrypt<T>(value: string, context: string): T {
  const [version, iv, tag, data] = value.split(".");
  if (version !== (process.env.TOKEN_KEY_VERSION ?? "1"))
    throw new Error("ENCRYPTION_KEY_VERSION_UNAVAILABLE");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "base64"),
    Buffer.from(iv, "base64url"),
  );
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      cipher.update(Buffer.from(data, "base64url")),
      cipher.final(),
    ]).toString("utf8"),
  );
}
