type DatabaseEnvironment = {
  [key: string]: string | undefined;
  DATABASE_URL?: string;
  DIRECT_DATABASE_URL?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
};

function isSupabasePooler(url: URL) {
  return url.hostname.endsWith(".pooler.supabase.com");
}

/** Session continuity is required by Prisma migrations and pg-boss. */
export function sessionDatabaseUrl(
  env: DatabaseEnvironment = process.env,
): string | undefined {
  const selected = env.DIRECT_DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!selected) return undefined;

  let session: URL;
  try {
    session = new URL(selected);
  } catch {
    throw new Error("Database connection variables must contain PostgreSQL URLs.");
  }

  const directProject = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(
    session.hostname,
  )?.[1];
  const onVercel = env.VERCEL === "1" || Boolean(env.VERCEL_ENV);

  // Supabase's default direct endpoint requires IPv6. Reuse the configured
  // pooler host on Vercel, keeping the migration/worker role and its password.
  if (onVercel && directProject && env.DATABASE_URL) {
    let application: URL;
    try {
      application = new URL(env.DATABASE_URL.trim());
    } catch {
      throw new Error("DATABASE_URL must contain a valid PostgreSQL URL.");
    }
    if (isSupabasePooler(application)) {
      if (
        !decodeURIComponent(application.username).endsWith(`.${directProject}`) ||
        application.pathname !== session.pathname
      ) {
        throw new Error(
          "DATABASE_URL and DIRECT_DATABASE_URL must target the same Supabase project and database. Copy both URLs from that project's Connect dialog.",
        );
      }
      session.hostname = application.hostname;
      session.username = `${decodeURIComponent(session.username)}.${directProject}`;
      session.port = "5432";
    }
  }

  if (isSupabasePooler(session)) {
    // Both shared pooler modes use the same host; 6543 is transaction mode.
    if (session.port === "6543") session.port = "5432";
    if (!session.searchParams.has("sslmode")) {
      session.searchParams.set("sslmode", "require");
    }
    return session.toString();
  }

  return selected;
}
