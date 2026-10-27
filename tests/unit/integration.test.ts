import { describe, it, expect, beforeEach } from "vitest";
import { allPages, providerError } from "@/lib/server/google";
import { encrypt, decrypt, digest } from "@/lib/server/crypto";
import {
  assertGoogleIdentity,
  assertOAuthTransaction,
} from "@/lib/server/oauth-validation";
import { normalizeGoogleEvent } from "@/lib/server/sync";
import { rangeSchema } from "@/lib/shared/schemas";
beforeEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.TOKEN_KEY_VERSION = "1";
});
describe("Google pagination", () => {
  it("follows empty and short intermediate pages", async () => {
    const seen: (string | undefined)[] = [];
    const result = await allPages<number>(async (token) => {
      seen.push(token);
      return !token
        ? { items: [1], nextPageToken: "two" }
        : token === "two"
          ? { items: [], nextPageToken: "three" }
          : { items: [2] };
    });
    expect(result).toEqual([1, 2]);
    expect(seen).toEqual([undefined, "two", "three"]);
  });
  it("does not return partial results if a later page fails", async () => {
    let publish = false;
    await expect(
      allPages<number>(async (token) => {
        if (token) throw new Error("upstream");
        return { items: [1], nextPageToken: "later" };
      }).then(() => {
        publish = true;
      }),
    ).rejects.toThrow("upstream");
    expect(publish).toBe(false);
  });
  it("rejects repeated page tokens instead of looping forever", async () => {
    await expect(
      allPages(async () => ({ items: [], nextPageToken: "same" })),
    ).rejects.toThrow("INVALID_PAGINATION");
  });
  it("classifies revocation, administrator denial, and rate limits", () => {
    expect(
      providerError({
        response: { status: 400, data: { error: "invalid_grant" } },
      }).code,
    ).toBe("REAUTH_REQUIRED");
    expect(providerError({ response: { status: 403 } }).code).toBe(
      "ACCESS_RESTRICTED",
    );
    expect(providerError({ response: { status: 429 } }).code).toBe(
      "RATE_LIMITED",
    );
  });
});
describe("encrypted credentials", () => {
  it("roundtrips tokens using authenticated account-bound encryption", () => {
    const encrypted = encrypt({ refresh_token: "secret" }, "owner:google-sub");
    expect(encrypted).not.toContain("secret");
    expect(decrypt(encrypted, "owner:google-sub")).toEqual({
      refresh_token: "secret",
    });
  });
  it("rejects tampering and another account's associated data", () => {
    const encrypted = encrypt({ refresh_token: "secret" }, "owner:one");
    expect(() => decrypt(encrypted, "owner:two")).toThrow();
    const parts = encrypted.split(".");
    parts[2] = Buffer.alloc(16).toString("base64url");
    expect(() => decrypt(parts.join("."), "owner:one")).toThrow();
  });
});
describe("OAuth transaction binding", () => {
  const transaction = () => ({
    ownerId: "owner",
    sessionHash: digest("session"),
    expiresAt: new Date("2030-01-01"),
    consumedAt: null,
  });
  it("accepts the right session and owner", () =>
    expect(() =>
      assertOAuthTransaction(
        transaction(),
        "owner",
        "session",
        new Date("2026-01-01"),
      ),
    ).not.toThrow());
  it("rejects a forged or missing transaction", () =>
    expect(() => assertOAuthTransaction(null, "owner", "session")).toThrow());
  it("rejects another session or owner", () => {
    expect(() =>
      assertOAuthTransaction(transaction(), "owner", "other"),
    ).toThrow();
    expect(() =>
      assertOAuthTransaction(transaction(), "other", "session"),
    ).toThrow();
  });
  it("rejects expired and replayed transactions", () => {
    expect(() =>
      assertOAuthTransaction(
        { ...transaction(), expiresAt: new Date("2020-01-01") },
        "owner",
        "session",
      ),
    ).toThrow();
    expect(() =>
      assertOAuthTransaction(
        { ...transaction(), consumedAt: new Date() },
        "owner",
        "session",
      ),
    ).toThrow();
  });
  it("rejects a wrong-account reconnect and nonce mismatch", () => {
    const identity = {
      sub: "one",
      email: "a@example.com",
      email_verified: true,
      nonce: "nonce",
    };
    expect(() => assertGoogleIdentity(identity, "nonce", "two")).toThrow();
    expect(() => assertGoogleIdentity(identity, "other", null)).toThrow();
    expect(() => assertGoogleIdentity(identity, "nonce", "one")).not.toThrow();
  });
});
describe("provider normalization and validation", () => {
  const source = {
      id: "source",
      googleCalendarId: "provider-calendar",
      title: "Work",
    },
    connection = {
      id: "connection",
      email: "a@example.com",
      label: "Work",
      color: "green",
    };
  it("keeps date-only all-day values date-only", () => {
    const e = normalizeGoogleEvent(
      {
        id: "event",
        start: { date: "2026-10-27" },
        end: { date: "2026-10-29" },
      },
      source,
      connection,
      "stable-reference",
    );
    expect(e?.start).toBe("2026-10-27");
    expect(e?.end).toBe("2026-10-29");
    expect(e?.allDay).toBe(true);
    expect(e?.id).toBe("stable-reference");
  });
  it("ignores canceled occurrences and removes HTML markup", () => {
    expect(
      normalizeGoogleEvent(
        { id: "cancel", status: "cancelled" },
        source,
        connection,
        "ref",
      ),
    ).toBeNull();
    const e = normalizeGoogleEvent(
      {
        id: "a",
        start: { dateTime: "2026-10-27T09:00:00+05:30" },
        end: { dateTime: "2026-10-27T10:00:00+05:30" },
        description: "<b>Notes</b>",
        hangoutLink: "javascript:alert(1)",
      },
      source,
      connection,
      "ref",
    );
    expect(e?.description).not.toContain("<b>");
    expect(e?.meetingUrl).toBeUndefined();
    expect(e?.start).toBe("2026-10-27T03:30:00.000Z");
  });
  it("rejects unbounded ranges and invalid time zones", () => {
    expect(
      rangeSchema.safeParse({ start: "2026-01-01", end: "2026-12-31" }).success,
    ).toBe(false);
    expect(
      rangeSchema.safeParse({
        start: "2026-10-27",
        end: "2026-10-28",
        timeZone: "Mars/Olympus",
      }).success,
    ).toBe(false);
  });
});
