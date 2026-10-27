import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { db } from "./db";
import { configuration } from "./config";
let instance: ReturnType<typeof buildAuth> | undefined;
function buildAuth() {
  const env = configuration();
  return betterAuth({
    appName: "Calora",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(db(), { provider: "postgresql" }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: ["openid", "email", "profile"],
        prompt: "select_account",
      },
    },
    account: { accountLinking: { enabled: false }, encryptOAuthTokens: true },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 12 },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (
              user.email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase() ||
              !user.emailVerified
            )
              throw new APIError("FORBIDDEN", {
                message: "This workspace is private.",
              });
            return { data: user };
          },
        },
      },
    },
    trustedOrigins: [env.BETTER_AUTH_URL],
    advanced: { useSecureCookies: env.BETTER_AUTH_URL.startsWith("https:") },
  });
}
export function auth() {
  return (instance ??= buildAuth());
}
export async function requireOwner(headers: Headers) {
  const session = await auth().api.getSession({ headers });
  const env = configuration();
  if (
    !session ||
    !session.user.emailVerified ||
    session.user.email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()
  )
    throw new APIError("UNAUTHORIZED", {
      message: "Sign in to your workspace.",
    });
  const account = await db().account.findFirst({
    where: { userId: session.user.id, providerId: "google" },
  });
  if (
    !account ||
    (env.OWNER_GOOGLE_SUB && account.accountId !== env.OWNER_GOOGLE_SUB)
  )
    throw new APIError("FORBIDDEN", { message: "This workspace is private." });
  return session;
}
