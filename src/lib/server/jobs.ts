import "server-only";
import { PgBoss } from "pg-boss";
import { digest } from "./crypto";
export type SyncJob = {
  ownerId: string;
  connectionId: string;
  start: string;
  end: string;
  timeZone: string;
  discover?: boolean;
  attempt?: number;
};
let bossPromise: Promise<PgBoss> | undefined;
export function jobs(worker = false) {
  return (bossPromise ??= (async () => {
    const boss = new PgBoss({
      connectionString:
        process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL!,
      max: worker ? 4 : 2,
      application_name: "calora",
      supervise: worker,
      schedule: worker,
    });
    boss.on("error", () => console.error("Calendar job service unavailable"));
    await boss.start();
    await boss.createQueue("calendar-sync", {
      retryLimit: 4,
      retryDelay: 15,
      retryBackoff: true,
      expireInSeconds: 300,
    });
    await boss.createQueue("calendar-maintenance");
    return boss;
  })().catch((e) => {
    bossPromise = undefined;
    throw e;
  }));
}
export async function enqueueSync(data: SyncJob) {
  const boss = await jobs();
  return boss.send("calendar-sync", data, {
    singletonKey: digest(JSON.stringify(data)),
    singletonSeconds: 30,
    retryLimit: 4,
    retryDelay: 15,
    retryBackoff: true,
  });
}
