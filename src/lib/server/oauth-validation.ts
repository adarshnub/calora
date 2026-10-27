import "server-only";
import { digest } from "./crypto";
import { AppError } from "./http";
export function assertOAuthTransaction(
  transaction: {
    ownerId: string;
    sessionHash: string;
    expiresAt: Date;
    consumedAt: Date | null;
  } | null,
  ownerId: string,
  sessionId: string,
  now = new Date(),
) {
  if (
    !transaction ||
    transaction.ownerId !== ownerId ||
    transaction.sessionHash !== digest(sessionId) ||
    transaction.expiresAt <= now ||
    transaction.consumedAt
  )
    throw new AppError("INVALID_OAUTH_TRANSACTION", 403);
}
export function assertGoogleIdentity(
  identity:
    | { sub?: string; email?: string; email_verified?: boolean; nonce?: string }
    | undefined,
  nonce: string,
  expectedSub: string | null,
) {
  if (
    !identity?.sub ||
    !identity.email ||
    !identity.email_verified ||
    identity.nonce !== nonce ||
    (expectedSub && expectedSub !== identity.sub)
  )
    throw new AppError("IDENTITY_MISMATCH", 403);
}
