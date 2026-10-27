import "server-only";
import { db } from "./db";
import { isLocalSetup } from "./config";
import {
  DEFAULT_PREFERENCES,
  type CalendarEvent,
  type Connection,
  type Preferences,
  type ScheduleResponse,
} from "../shared/types";
import { dateInstant, eventInRange } from "../shared/dates";
import { enqueueSync } from "./jobs";
export async function connectionsFor(ownerId: string): Promise<Connection[]> {
  if (isLocalSetup()) return [];
  const rows = await db().googleConnection.findMany({
    where: { ownerId },
    select: {
      id: true,
      email: true,
      label: true,
      color: true,
      status: true,
      lastError: true,
      sources: {
        select: {
          id: true,
          title: true,
          primary: true,
          selected: true,
          accessRole: true,
          accessStatus: true,
        },
        orderBy: { primary: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows as Connection[];
}
export async function preferencesFor(ownerId: string): Promise<Preferences> {
  if (isLocalSetup()) return DEFAULT_PREFERENCES;
  const saved = await db().userPreference.findUnique({ where: { ownerId } });
  return { ...DEFAULT_PREFERENCES, ...((saved?.data as object) ?? {}) };
}
export async function scheduleFor(
  ownerId: string,
  range: { start: string; end: string; timeZone: string; sources?: string[] },
): Promise<ScheduleResponse> {
  if (isLocalSetup())
    return {
      events: [],
      sourceStatus: [],
      coverageComplete: false,
    };
  const sources = await db().calendarSource.findMany({
    where: {
      connection: { ownerId },
      ...(range.sources ? { id: { in: range.sources } } : { selected: true }),
    },
    include: { connection: true },
  });
  const events: CalendarEvent[] = [],
    sourceStatus: ScheduleResponse["sourceStatus"] = [];
  const enqueues = new Set<string>();
  for (const source of sources) {
    if (
      source.accessStatus !== "available" ||
      source.connection.status !== "connected"
    ) {
      sourceStatus.push({
        sourceId: source.id,
        state:
          source.connection.status === "reconnect" ? "reconnect" : "restricted",
        fetchedAt: null,
        coverage: false,
      });
      continue;
    }
    const snapshot = await db().calendarSnapshot.findFirst({
      where: {
        sourceId: source.id,
        status: "active",
        queryVersion: 1,
        queryZone: range.timeZone,
        rangeStart: { lte: new Date(dateInstant(range.start, range.timeZone)) },
        rangeEnd: { gte: new Date(dateInstant(range.end, range.timeZone)) },
      },
      orderBy: { fetchedAt: "desc" },
      include: { events: true },
    });
    const fresh = snapshot && snapshot.expiresAt.getTime() > Date.now();
    sourceStatus.push({
      sourceId: source.id,
      state: fresh ? "fresh" : source.lastError ? "stale" : "loading",
      fetchedAt: snapshot?.fetchedAt.toISOString() ?? null,
      coverage: !!snapshot,
    });
    if (snapshot)
      for (const row of snapshot.events) {
        const event = {
          ...(row.data as unknown as CalendarEvent),
          color: source.connection.color as CalendarEvent["color"],
          accountLabel: source.connection.label,
          accountEmail: source.connection.email,
        };
        if (eventInRange(event, range.start, range.end, range.timeZone))
          events.push(event);
      }
    if (!fresh) enqueues.add(source.connectionId);
  }
  await Promise.allSettled(
    [...enqueues].map((connectionId) =>
      enqueueSync({ ...range, ownerId, connectionId }),
    ),
  );
  return {
    events,
    sourceStatus,
    coverageComplete: sourceStatus.every(
      (s) => s.coverage && s.state === "fresh",
    ),
  };
}
