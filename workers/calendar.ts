import { config as loadEnv } from "dotenv";
import { jobs } from "../src/lib/server/jobs";
import { syncConnection } from "../src/lib/server/sync";
import { db } from "../src/lib/server/db";
import { configuration } from "../src/lib/server/config";
import type { SyncJob } from "../src/lib/server/jobs";
import { addDays, today } from "../src/lib/shared/dates";
import { AppError } from "../src/lib/server/http";

loadEnv({ path: [".env.local", ".env"], quiet: true });

async function main() {
  configuration();
  const boss = await jobs(true);
  await boss.work<SyncJob>(
    "calendar-sync",
    { localConcurrency: 2, batchSize: 1 },
    async (jobs) => {
      for (const job of jobs) {
        try {
          await syncConnection(job.data);
        } catch (error) {
          if (
            error instanceof AppError &&
            error.code === "RATE_LIMITED" &&
            (job.data.attempt ?? 0) < 4
          ) {
            await boss.sendAfter(
              "calendar-sync",
              { ...job.data, attempt: (job.data.attempt ?? 0) + 1 },
              { retryLimit: 0 },
              Math.min(3600, error.retryAfter ?? 30) +
                Math.ceil(Math.random() * 5),
            );
          } else throw error;
        }
      }
    },
  );
  await boss.work("calendar-maintenance", async () => {
    await db().oAuthTransaction.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    await db().calendarSnapshot.deleteMany({
      where: {
        OR: [
          { status: "superseded" },
          { fetchedAt: { lt: new Date(Date.now() - 7 * 86400000) } },
        ],
      },
    });
    const date = today();
    const connections = await db().googleConnection.findMany({
      where: { status: "connected" },
      select: { id: true, ownerId: true },
    });
    for (const c of connections)
      await boss.send("calendar-sync", {
        ownerId: c.ownerId,
        connectionId: c.id,
        start: date,
        end: addDays(date, 14),
        timeZone: "Asia/Kolkata",
        discover: true,
      });
  });
  await boss.schedule("calendar-maintenance", "0 3 * * *", {});
  console.info("Calora worker ready");
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, async () => {
      await boss.stop();
      await db().$disconnect();
      process.exit(0);
    });
}
main().catch(() => {
  console.error(
    "Calora worker failed. Check database and server configuration.",
  );
  process.exit(1);
});
