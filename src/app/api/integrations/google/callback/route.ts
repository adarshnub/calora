import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/server/auth";
import { configuration } from "@/lib/server/config";
import { db } from "@/lib/server/db";
import { decrypt, digest, encrypt } from "@/lib/server/crypto";
import { CALENDAR_SCOPES, googleClient } from "@/lib/server/google";
import { enqueueSync } from "@/lib/server/jobs";
import { addDays, today } from "@/lib/shared/dates";
import type { Credentials } from "google-auth-library";
import {
  assertOAuthTransaction,
  assertGoogleIdentity,
} from "@/lib/server/oauth-validation";
export async function GET(request: Request) {
  const base = process.env.BETTER_AUTH_URL ?? new URL(request.url).origin;
  try {
    const session = await requireOwner(request.headers),
      url = new URL(request.url),
      state = url.searchParams.get("state"),
      code = url.searchParams.get("code");
    if (!state || state.length > 256) throw new Error("INVALID_STATE");
    const transaction = await db().oAuthTransaction.findUnique({
      where: { stateHash: digest(state) },
    });
    assertOAuthTransaction(transaction, session.user.id, session.session.id);
    if (!transaction) throw new Error("INVALID_STATE");
    const consumed = await db().oAuthTransaction.updateMany({
      where: {
        id: transaction.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1 || !code || url.searchParams.has("error"))
      throw new Error("AUTHORIZATION_CANCELLED");
    const client = googleClient();
    const { tokens } = await client.getToken({
      code,
      codeVerifier: decrypt<string>(transaction.verifier, session.user.id),
    });
    if (!tokens.id_token) throw new Error("IDENTITY_MISSING");
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: configuration().GOOGLE_CLIENT_ID,
    });
    const identity = ticket.getPayload();
    assertGoogleIdentity(
      identity as Parameters<typeof assertGoogleIdentity>[0],
      transaction.nonce,
      transaction.expectedSub,
    );
    if (!identity?.sub || !identity.email) throw new Error("IDENTITY_MISSING");
    const scopes =
      tokens.scope?.split(" ") ??
      (tokens.access_token
        ? (await client.getTokenInfo(tokens.access_token)).scopes
        : []);
    if (!CALENDAR_SCOPES.every((s) => scopes.includes(s)))
      throw new Error("SCOPES_MISSING");
    const existing = await db().googleConnection.findUnique({
      where: {
        ownerId_googleSub: {
          ownerId: session.user.id,
          googleSub: identity.sub,
        },
      },
    });
    const previous = existing
      ? decrypt<Credentials>(
          existing.encryptedTokens,
          session.user.id + ":" + identity.sub,
        )
      : {};
    if (!tokens.refresh_token && !previous.refresh_token)
      throw new Error("REFRESH_TOKEN_MISSING");
    const data = {
      email: identity.email,
      encryptedTokens: encrypt(
        {
          ...previous,
          ...tokens,
          refresh_token: tokens.refresh_token ?? previous.refresh_token,
        },
        session.user.id + ":" + identity.sub,
      ),
      grantedScopes: scopes,
      status: "connected",
      lastError: null,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    };
    const count = await db().googleConnection.count({
      where: { ownerId: session.user.id },
    });
    const connection = await db().googleConnection.upsert({
      where: {
        ownerId_googleSub: {
          ownerId: session.user.id,
          googleSub: identity.sub,
        },
      },
      create: {
        ...data,
        ownerId: session.user.id,
        googleSub: identity.sub,
        label: identity.email.split("@")[0],
        color: ["green", "orange", "purple", "blue"][count % 4],
      },
      update: { ...data, credentialVersion: { increment: 1 } },
    });
    const date = today();
    await enqueueSync({
      ownerId: session.user.id,
      connectionId: connection.id,
      start: date,
      end: addDays(date, 14),
      timeZone: "Asia/Kolkata",
      discover: true,
    });
    return NextResponse.redirect(
      new URL(transaction.returnPath + "?connected=1", base),
    );
  } catch {
    return NextResponse.redirect(new URL("/accounts?connectionError=1", base));
  }
}
