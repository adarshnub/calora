import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/server/auth";
import { configuration, configurationStatus } from "@/lib/server/config";
import { digest, encrypt, randomSecret } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { CALENDAR_SCOPES, googleClient } from "@/lib/server/google";
import {
  AppError,
  errorResponse,
  json,
  protectMutation,
} from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    if (!configurationStatus().ready)
      return json(
        {
          error: {
            code: "CONFIGURATION_REQUIRED",
            missing: configurationStatus().missing,
          },
        },
        503,
      );
    const session = await requireOwner(request.headers);
    protectMutation(request, session.user.id + ":oauth", 10);
    const input = z
      .object({
        connectionId: z.string().optional(),
        returnPath: z.enum(["/", "/accounts"]).default("/accounts"),
      })
      .parse(await request.json());
    const existing = input.connectionId
      ? await db().googleConnection.findFirst({
          where: { id: input.connectionId, ownerId: session.user.id },
        })
      : null;
    if (input.connectionId && !existing) throw new AppError("NOT_FOUND", 404);
    const state = randomSecret(),
      nonce = randomSecret(),
      client = googleClient();
    const { codeVerifier, codeChallenge } =
      await client.generateCodeVerifierAsync();
    await db().oAuthTransaction.create({
      data: {
        stateHash: digest(state),
        ownerId: session.user.id,
        sessionHash: digest(session.session.id),
        nonce,
        verifier: encrypt(codeVerifier, session.user.id),
        purpose: existing ? "reconnect" : "connect",
        expectedSub: existing?.googleSub,
        returnPath: input.returnPath,
        expiresAt: new Date(Date.now() + 10 * 60000),
      },
    });
    const url = client.generateAuthUrl({
      scope: ["openid", "email", ...CALENDAR_SCOPES],
      access_type: "offline",
      prompt: "select_account consent",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256" as never,
    });
    const target = new URL(url);
    target.searchParams.set("nonce", nonce);
    return json({ url: target.toString() });
  } catch (error) {
    return errorResponse(error);
  }
}
