import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public retryAfter?: number,
  ) {
    super(code);
  }
}
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json(
      { error: { code: error.code } },
      {
        status: error.status,
        headers: {
          "Cache-Control": "private, no-store",
          ...(error.retryAfter
            ? { "Retry-After": String(error.retryAfter) }
            : {}),
        },
      },
    );
  if (error instanceof ZodError)
    return json(
      { error: { code: "INVALID_INPUT", message: error.issues[0]?.message } },
      400,
    );
  const status =
    error && typeof error === "object" && "statusCode" in error
      ? Number(error.statusCode)
      : 503;
  return json(
    {
      error: {
        code:
          status === 401
            ? "UNAUTHORIZED"
            : status === 403
              ? "ACCESS_RESTRICTED"
              : "PROVIDER_UNAVAILABLE",
      },
    },
    status,
  );
}
const attempts = new Map<string, { count: number; until: number }>();
export function protectMutation(request: Request, key: string, limit = 30) {
  const origin = request.headers.get("origin"),
    expected = process.env.BETTER_AUTH_URL ?? new URL(request.url).origin;
  if (!origin || origin !== new URL(expected).origin)
    throw new AppError("INVALID_ORIGIN", 403);
  const now = Date.now();
  if (attempts.size > 1000)
    for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const entry = attempts.get(key);
  if (entry && entry.until > now) {
    if (entry.count >= limit) throw new AppError("RATE_LIMITED", 429, 60);
    entry.count++;
  } else attempts.set(key, { count: 1, until: now + 60000 });
  if (Number(request.headers.get("content-length") ?? 0) > 32768)
    throw new AppError("REQUEST_TOO_LARGE", 413);
}
