import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function run(relativeCliPath, args) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL(relativeCliPath, import.meta.url)), ...args],
    { stdio: "inherit", env: process.env },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("../node_modules/prisma/build/index.js", ["generate"]);

// Preview deployments must never migrate the production database.
if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "Set DATABASE_URL in Vercel's Production environment before deployment.",
    );
  }
  run("../node_modules/prisma/build/index.js", ["migrate", "deploy"]);
}

run("../node_modules/next/dist/bin/next", ["build"]);
