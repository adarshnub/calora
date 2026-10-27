import "server-only";
import { OAuth2Client, type Credentials } from "google-auth-library";
import { db } from "./db";
import { configuration } from "./config";
import { decrypt, encrypt } from "./crypto";
import { AppError } from "./http";
export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];
export function googleClient() {
  const env = configuration();
  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `${env.BETTER_AUTH_URL}/api/integrations/google/callback`,
  );
}
export function providerError(error: unknown) {
  const e = error as {
    response?: {
      status?: number;
      data?: { error?: unknown };
      headers?: { get?: (name: string) => string | null };
    };
    code?: number;
  };
  const status = e.response?.status ?? e.code;
  const category = JSON.stringify(e.response?.data?.error ?? "");
  if (status === 401 || category.includes("invalid_grant"))
    return new AppError("REAUTH_REQUIRED", 401);
  if ((status === 403 && !category.includes("rateLimit")) || status === 404)
    return new AppError("ACCESS_RESTRICTED", 403);
  if (status === 429 || category.includes("rateLimit"))
    return new AppError(
      "RATE_LIMITED",
      429,
      Number(e.response?.headers?.get?.("retry-after")) || 30,
    );
  return new AppError("PROVIDER_UNAVAILABLE", 503);
}
export async function accessToken(connectionId: string) {
  try {
    return await db().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${connectionId}))`;
        const connection = await tx.googleConnection.findUnique({
          where: { id: connectionId },
        });
        if (!connection || connection.status !== "connected")
          throw new AppError("REAUTH_REQUIRED", 401);
        const credentials = decrypt<Credentials>(
          connection.encryptedTokens,
          connection.ownerId + ":" + connection.googleSub,
        );
        const client = googleClient();
        client.setCredentials(credentials);
        const token = await client.getAccessToken();
        if (!token.token) throw new AppError("REAUTH_REQUIRED", 401);
        await tx.googleConnection.update({
          where: { id: connectionId },
          data: {
            encryptedTokens: encrypt(
              { ...credentials, ...client.credentials },
              connection.ownerId + ":" + connection.googleSub,
            ),
            tokenExpiry: client.credentials.expiry_date
              ? new Date(client.credentials.expiry_date)
              : null,
          },
        });
        return token.token;
      },
      { timeout: 45000 },
    );
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw providerError(e);
  }
}
export async function googleGet<T>(
  connectionId: string,
  path: string,
  params: Record<string, string> = {},
) {
  const client = googleClient();
  client.setCredentials({ access_token: await accessToken(connectionId) });
  try {
    return (
      await client.request<T>({
        url: `https://www.googleapis.com/calendar/v3/${path}`,
        params,
        timeout: 30000,
      })
    ).data;
  } catch (e) {
    throw providerError(e);
  }
}
export async function allPages<T>(
  fetchPage: (
    token?: string,
  ) => Promise<{ items?: T[]; nextPageToken?: string }>,
) {
  const items: T[] = [];
  let token: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await fetchPage(token);
    items.push(...(page.items ?? []));
    token = page.nextPageToken;
    if (token) {
      if (seen.has(token)) throw new AppError("INVALID_PAGINATION", 503);
      seen.add(token);
    }
  } while (token);
  return items;
}
