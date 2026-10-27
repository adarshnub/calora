import { describe, expect, it } from "vitest";
import { X509Certificate } from "node:crypto";
import { databaseConnectionOptions } from "../../src/lib/server/database-connection";
import { SUPABASE_CA } from "../../src/lib/server/supabase-ca";

describe("Supabase certificate trust", () => {
  it("uses the provider CA with verification for direct and pooled hosts", () => {
    for (const host of [
      "db.projectone.supabase.co",
      "aws-1-ap-southeast-2.pooler.supabase.com",
    ]) {
      const options = databaseConnectionOptions(
        `postgresql://postgres:password@${host}:5432/postgres?sslmode=require&application_name=calora`,
      );
      expect(options.ssl).toEqual({ ca: SUPABASE_CA, rejectUnauthorized: true });
      const url = new URL(options.connectionString!);
      expect(url.searchParams.has("sslmode")).toBe(false);
      expect(url.searchParams.get("application_name")).toBe("calora");
    }
  });

  it("bundles a valid, self-signed provider CA", () => {
    const certificate = new X509Certificate(SUPABASE_CA);
    expect(certificate.ca).toBe(true);
    expect(certificate.subject).toContain("Supabase Root 2021 CA");
    expect(certificate.verify(certificate.publicKey)).toBe(true);
    expect(new Date(certificate.validTo).getTime()).toBeGreaterThan(Date.now());
  });

  it("preserves custom certificate configuration and other providers", () => {
    for (const url of [
      "postgresql://user:password@localhost:5432/calora",
      "postgresql://user:password@other.example.com/calora?sslmode=verify-full",
      "postgresql://postgres:password@db.projectone.supabase.co/postgres?sslmode=verify-full&sslrootcert=custom.crt",
    ]) {
      expect(databaseConnectionOptions(url)).toEqual({ connectionString: url });
    }
  });
});
