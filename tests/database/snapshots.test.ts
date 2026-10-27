import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
import { syncConnection, type GoogleEvent } from "@/lib/server/sync";
import { googleGet } from "@/lib/server/google";
import { AppError } from "@/lib/server/http";
import { jobs } from "@/lib/server/jobs";
vi.mock("@/lib/server/google", async (original) => ({
  ...(await original<typeof import("@/lib/server/google")>()),
  googleGet: vi.fn(),
}));
const owners: string[] = [];
let ownerId: string, connectionId: string, sourceId: string;
const sample = (id: string): GoogleEvent => ({
  id,
  summary: `Meeting ${id}`,
  start: { dateTime: "2026-10-27T09:00:00+05:30" },
  end: { dateTime: "2026-10-27T10:00:00+05:30" },
});
const job = () => ({
  ownerId,
  connectionId,
  start: "2026-10-26",
  end: "2026-11-02",
  timeZone: "Asia/Kolkata",
});
beforeAll(() => {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Set DATABASE_URL to a migrated test database before running database integration tests.",
    );
});
beforeEach(async () => {
  vi.mocked(googleGet).mockReset();
  const owner = await db().user.create({
    data: {
      name: "Integration test",
      email: `calora-test-${randomUUID()}@example.invalid`,
      emailVerified: true,
    },
  });
  ownerId = owner.id;
  owners.push(ownerId);
  const connection = await db().googleConnection.create({
    data: {
      ownerId,
      googleSub: randomUUID(),
      email: owner.email,
      label: "Test",
      grantedScopes: [],
      encryptedTokens: "mock-provider-does-not-use-tokens",
      sources: {
        create: {
          googleCalendarId: "test-calendar",
          title: "Test calendar",
          accessRole: "owner",
          selected: true,
        },
      },
    },
    include: { sources: true },
  });
  connectionId = connection.id;
  sourceId = connection.sources[0].id;
});
afterAll(async () => {
  await db().user.deleteMany({ where: { id: { in: owners } } });
  await db().$disconnect();
});
describe("PostgreSQL snapshot publication", () => {
  it("persists durable jobs in PostgreSQL and can retrieve their opaque payloads", async () => {
    const boss = await jobs(true);
    const name = `calora-test-${randomUUID()}`;
    try {
      await boss.createQueue(name);
      const id = await boss.send(name, { ownerId, connectionId });
      expect(id).toBeTruthy();
      const records = await boss.fetch<{
        ownerId: string;
        connectionId: string;
      }>(name);
      expect(records).toHaveLength(1);
      expect(records[0].data).toEqual({ ownerId, connectionId });
      await boss.complete(name, records[0].id);
      await boss.deleteQueue(name);
    } finally {
      await boss.stop();
    }
  });
  it("publishes complete pagination and replaces removed events while retaining stable references", async () => {
    vi.mocked(googleGet).mockImplementation(async (_id, _path, params) =>
      params?.pageToken
        ? { items: [sample("two")] }
        : { items: [sample("one")], nextPageToken: "page-two" },
    );
    await syncConnection(job());
    const first = await db().calendarSnapshot.findFirstOrThrow({
      where: { sourceId, status: "active" },
      include: { events: true },
    });
    expect(first.events).toHaveLength(2);
    const stableId = first.events.find(
      (e) => e.googleEventId === "two",
    )!.eventReferenceId;
    vi.mocked(googleGet).mockResolvedValue({ items: [sample("two")] });
    await syncConnection(job());
    const active = await db().calendarSnapshot.findMany({
      where: { sourceId, status: "active" },
      include: { events: true },
    });
    expect(active).toHaveLength(1);
    expect(active[0].events.map((e) => e.googleEventId)).toEqual(["two"]);
    expect(active[0].events[0].eventReferenceId).toBe(stableId);
    expect(active[0].id).not.toBe(first.id);
  });
  it("retains the successful generation after a later-page failure", async () => {
    vi.mocked(googleGet).mockResolvedValue({ items: [sample("old")] });
    await syncConnection(job());
    const old = await db().calendarSnapshot.findFirstOrThrow({
      where: { sourceId, status: "active" },
    });
    vi.mocked(googleGet).mockImplementation(async (_id, _path, params) => {
      if (params?.pageToken) throw new AppError("PROVIDER_UNAVAILABLE", 503);
      return { items: [sample("partial")], nextPageToken: "later" };
    });
    await expect(syncConnection(job())).rejects.toThrow("PROVIDER_UNAVAILABLE");
    const active = await db().calendarSnapshot.findFirstOrThrow({
      where: { sourceId, status: "active" },
      include: { events: true },
    });
    expect(active.id).toBe(old.id);
    expect(active.events[0].googleEventId).toBe("old");
  });
  it("cannot publish an in-flight fetch after a connection is disabled", async () => {
    vi.mocked(googleGet).mockImplementation(async () => {
      await db().googleConnection.update({
        where: { id: connectionId },
        data: { status: "disconnected", credentialVersion: { increment: 1 } },
      });
      return { items: [sample("late")] };
    });
    await syncConnection(job());
    expect(await db().calendarSnapshot.count({ where: { sourceId } })).toBe(0);
  });
  it("restricts a denied source without hiding a healthy calendar", async () => {
    const blocked = await db().calendarSource.create({
      data: {
        connectionId,
        googleCalendarId: "blocked",
        title: "Blocked",
        accessRole: "reader",
        selected: true,
      },
    });
    vi.mocked(googleGet).mockImplementation(async (_id, path) => {
      if (path.includes("blocked"))
        throw new AppError("ACCESS_RESTRICTED", 403);
      return { items: [sample("healthy")] };
    });
    await syncConnection(job());
    expect(
      (
        await db().calendarSource.findUniqueOrThrow({
          where: { id: blocked.id },
        })
      ).accessStatus,
    ).toBe("restricted");
    expect(
      await db().calendarSnapshot.count({
        where: { sourceId, status: "active" },
      }),
    ).toBe(1);
    expect(
      (
        await db().googleConnection.findUniqueOrThrow({
          where: { id: connectionId },
        })
      ).status,
    ).toBe("connected");
  });
});
