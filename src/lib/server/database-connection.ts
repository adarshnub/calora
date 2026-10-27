import type { PoolConfig } from "pg";
import { SUPABASE_CA } from "./supabase-ca";

/** Supabase's private CA must be trusted explicitly by Node's PostgreSQL driver. */
export function databaseConnectionOptions(
  connectionString: string | undefined,
): Pick<PoolConfig, "connectionString" | "ssl"> {
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Database connection variables must contain PostgreSQL URLs.");
  }
  const supabase =
    url.hostname.endsWith(".pooler.supabase.com") ||
    /^db\.[a-z0-9]+\.supabase\.co$/i.test(url.hostname);
  if (!supabase || url.searchParams.has("sslrootcert")) {
    return { connectionString };
  }

  // pg replaces an explicit ssl object when sslmode is present in the URL.
  // Provide the provider's CA directly and retain certificate/hostname checks.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");
  return {
    connectionString: url.toString(),
    ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
  };
}
