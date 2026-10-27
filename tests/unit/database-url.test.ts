import { describe, expect, it } from "vitest";
import { sessionDatabaseUrl } from "../../src/lib/server/database-url";

const pooler =
  "postgresql://postgres.projectone:app-password@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const direct =
  "postgresql://migration_role:private%40password@db.projectone.supabase.co:5432/postgres?sslmode=require";

describe("session database connections", () => {
  it("uses the configured Supabase pooler on Vercel with the migration role and password", () => {
    const result = new URL(
      sessionDatabaseUrl({
        DATABASE_URL: pooler,
        DIRECT_DATABASE_URL: direct,
        VERCEL: "1",
      })!,
    );
    expect(result.hostname).toBe("aws-1-ap-southeast-2.pooler.supabase.com");
    expect(result.port).toBe("5432");
    expect(result.username).toBe("migration_role.projectone");
    expect(decodeURIComponent(result.password)).toBe("private@password");
    expect(result.searchParams.get("sslmode")).toBe("require");
  });

  it("also selects session mode during Vercel production builds", () => {
    const result = new URL(
      sessionDatabaseUrl({
        DATABASE_URL: pooler,
        DIRECT_DATABASE_URL: direct,
        VERCEL_ENV: "production",
      })!,
    );
    expect(result.hostname).toBe("aws-1-ap-southeast-2.pooler.supabase.com");
    expect(result.port).toBe("5432");
  });

  it("does not select a different Supabase project or database", () => {
    for (const app of [
      pooler.replace(".projectone:", ".anotherproject:"),
      pooler.replace(":6543/postgres", ":6543/anotherdatabase"),
    ]) {
      expect(() =>
        sessionDatabaseUrl({
          DATABASE_URL: app,
          DIRECT_DATABASE_URL: direct,
          VERCEL: "1",
        }),
      ).toThrow("must target the same Supabase project and database");
    }
  });

  it("uses session mode when only a Supabase transaction URL is configured", () => {
    const result = new URL(sessionDatabaseUrl({ DATABASE_URL: pooler })!);
    expect(result.port).toBe("5432");
    expect(result.username).toBe("postgres.projectone");
    expect(result.searchParams.get("sslmode")).toBe("require");
  });

  it("corrects a transaction URL mistakenly supplied for migrations", () => {
    expect(
      new URL(sessionDatabaseUrl({ DIRECT_DATABASE_URL: pooler })!).port,
    ).toBe("5432");
  });

  it("preserves a configured session pooler and its TLS settings", () => {
    const session = pooler.replace(":6543/", ":5432/") + "?sslmode=verify-full";
    expect(sessionDatabaseUrl({ DIRECT_DATABASE_URL: session })).toBe(session);
  });

  it("preserves other providers, local databases, and direct IPv6 connections outside Vercel", () => {
    for (const url of [
      direct,
      "postgresql://user:password@localhost:5432/calora",
      "postgresql://user:password@database.example.com:5432/calora?sslmode=require",
    ]) {
      expect(sessionDatabaseUrl({ DIRECT_DATABASE_URL: url })).toBe(url);
    }
  });

  it("keeps explicit connections to other providers on Vercel", () => {
    const url = "postgresql://user:password@database.example.com/calora";
    expect(
      sessionDatabaseUrl({
        DATABASE_URL: pooler,
        DIRECT_DATABASE_URL: url,
        VERCEL_ENV: "production",
      }),
    ).toBe(url);
  });

  it("does not invent a pooler host when none was configured", () => {
    expect(
      sessionDatabaseUrl({ DIRECT_DATABASE_URL: direct, VERCEL: "1" }),
    ).toBe(direct);
    expect(sessionDatabaseUrl({})).toBeUndefined();
  });
});
