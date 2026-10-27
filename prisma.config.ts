import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { sessionDatabaseUrl } from "./src/lib/server/database-url";

loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      sessionDatabaseUrl() ||
      "postgresql://calora:calora@localhost:5432/calora",
  },
});
