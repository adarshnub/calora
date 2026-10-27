import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { allPages, googleGet } from "./google";
import type { SyncJob } from "./jobs";
import type { CalendarEvent, Color } from "../shared/types";
import { addDays, dateInstant } from "../shared/dates";
import { safeExternalUrl } from "../shared/calendar";
import { AppError } from "./http";
type GoogleCalendar = {
  id: string;
  summary?: string;
  timeZone?: string;
  accessRole?: string;
  primary?: boolean;
  deleted?: boolean;
};
export type GoogleEvent = {
  id: string;
  summary?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  iCalUID?: string;
  recurringEventId?: string;
  originalStartTime?: { date?: string; dateTime?: string };
  description?: string;
  location?: string;
  organizer?: { email?: string; displayName?: string };
  attendees?: {
    self?: boolean;
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }[];
  transparency?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};
export function normalizeGoogleEvent(
  raw: GoogleEvent,
  source: { id: string; googleCalendarId: string; title: string },
  connection: { id: string; label: string; email: string; color: string },
  referenceId: string,
): CalendarEvent | null {
  if (raw.status === "cancelled" || !raw.start || !raw.end) return null;
  const allDay = !!raw.start.date;
  const start = allDay ? raw.start.date : raw.start.dateTime,
    end = allDay ? raw.end.date : raw.end.dateTime;
  if (!start || !end) return null;
  const self = raw.attendees?.find((a) => a.self);
  return {
    id: referenceId,
    sourceId: source.id,
    connectionId: connection.id,
    calendarKey: source.googleCalendarId,
    providerEventId: raw.id,
    title: raw.summary ?? "Busy",
    start: allDay ? start : new Date(start).toISOString(),
    end: allDay ? end : new Date(end).toISOString(),
    allDay,
    color: connection.color as Color,
    calendarTitle: source.title,
    accountLabel: connection.label,
    accountEmail: connection.email,
    iCalUID: raw.iCalUID,
    recurringEventId: raw.recurringEventId,
    originalStart:
      raw.originalStartTime?.date ?? raw.originalStartTime?.dateTime,
    description: raw.description?.replace(/<[^>]*>/g, " ").slice(0, 20000),
    location: raw.location,
    organizer: raw.organizer?.displayName ?? raw.organizer?.email,
    response: (self?.responseStatus ?? "accepted") as CalendarEvent["response"],
    transparency: raw.transparency === "transparent" ? "transparent" : "opaque",
    status: raw.status ?? "confirmed",
    meetingUrl: safeExternalUrl(
      raw.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")
        ?.uri ?? raw.hangoutLink,
    ),
    htmlLink: safeExternalUrl(raw.htmlLink),
    attendees: raw.attendees?.slice(0, 100).map((a) => ({
      name: a.displayName ?? a.email ?? "Guest",
      email: a.email ?? "",
      response: a.responseStatus ?? "needsAction",
    })),
  };
}
async function discover(job: SyncJob) {
  const connection = await db().googleConnection.findFirst({
    where: { id: job.connectionId, ownerId: job.ownerId, status: "connected" },
  });
  if (!connection) return;
  const calendars = await allPages<GoogleCalendar>((token) =>
    googleGet(job.connectionId, "users/me/calendarList", {
      showHidden: "true",
      maxResults: "250",
      ...(token ? { pageToken: token } : {}),
    }),
  );
  await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "GoogleConnection" WHERE id = ${connection.id} FOR UPDATE`;
    const current = await tx.googleConnection.findUnique({
      where: { id: connection.id },
    });
    if (
      !current ||
      current.status !== "connected" ||
      current.credentialVersion !== connection.credentialVersion
    )
      return;
    const ids = calendars.filter((c) => !c.deleted).map((c) => c.id);
    const previous = await tx.calendarSource.findMany({
      where: { connectionId: connection.id },
    });
    for (const source of previous)
      if (!ids.includes(source.googleCalendarId)) {
        await tx.calendarSource.update({
          where: { id: source.id },
          data: {
            accessStatus: "unavailable",
            accessStatusVersion: { increment: 1 },
          },
        });
        await tx.calendarSnapshot.deleteMany({
          where: { sourceId: source.id },
        });
      }
    for (const calendar of calendars.filter((c) => !c.deleted)) {
      const old = previous.find((s) => s.googleCalendarId === calendar.id);
      const available = ["owner", "writer", "reader"].includes(
        calendar.accessRole ?? "",
      );
      if (old && (old.accessRole !== calendar.accessRole || !available))
        await tx.calendarSnapshot.deleteMany({ where: { sourceId: old.id } });
      const data = {
        title: calendar.summary ?? "Untitled calendar",
        timeZone: calendar.timeZone ?? "UTC",
        accessRole: calendar.accessRole ?? "none",
        accessStatus: available ? "available" : "restricted",
        primary: !!calendar.primary,
        lastDiscoveredAt: new Date(),
      };
      await tx.calendarSource.upsert({
        where: {
          connectionId_googleCalendarId: {
            connectionId: connection.id,
            googleCalendarId: calendar.id,
          },
        },
        create: {
          ...data,
          connectionId: connection.id,
          googleCalendarId: calendar.id,
          selected: !!calendar.primary,
        },
        update: {
          ...data,
          ...(old?.accessRole !== calendar.accessRole
            ? { accessStatusVersion: { increment: 1 } }
            : {}),
        },
      });
    }
  });
}
export async function syncConnection(job: SyncJob) {
  const connection = await db().googleConnection.findFirst({
    where: { id: job.connectionId, ownerId: job.ownerId, status: "connected" },
  });
  if (!connection) return;
  try {
    if (job.discover) await discover(job);
    const sources = await db().calendarSource.findMany({
      where: {
        connectionId: connection.id,
        accessStatus: "available",
        selected: true,
      },
    });
    let retryableFailure: unknown;
    for (const source of sources) {
      try {
        const raw = await allPages<GoogleEvent>((token) =>
          googleGet(
            connection.id,
            `calendars/${encodeURIComponent(source.googleCalendarId)}/events`,
            {
              timeMin: dateInstant(addDays(job.start, -2), job.timeZone),
              timeMax: dateInstant(addDays(job.end, 2), job.timeZone),
              singleEvents: "true",
              showDeleted: "false",
              orderBy: "startTime",
              maxResults: "2500",
              timeZone: job.timeZone,
              ...(token ? { pageToken: token } : {}),
            },
          ),
        );
        // Nothing is published until every page has succeeded. Lock and recheck access
        // inside the publication transaction so disconnection cannot resurrect content.
        await db().$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT id FROM "GoogleConnection" WHERE id = ${connection.id} FOR UPDATE`;
            await tx.$executeRaw`SELECT id FROM "CalendarSource" WHERE id = ${source.id} FOR UPDATE`;
            const [current, freshSource] = await Promise.all([
              tx.googleConnection.findUnique({ where: { id: connection.id } }),
              tx.calendarSource.findUnique({ where: { id: source.id } }),
            ]);
            if (
              !current ||
              current.status !== "connected" ||
              current.credentialVersion !== connection.credentialVersion ||
              !freshSource ||
              freshSource.accessStatus !== "available" ||
              freshSource.accessStatusVersion !== source.accessStatusVersion
            )
              return;
            const snapshot = await tx.calendarSnapshot.create({
              data: {
                sourceId: source.id,
                rangeStart: new Date(dateInstant(job.start, job.timeZone)),
                rangeEnd: new Date(dateInstant(job.end, job.timeZone)),
                queryZone: job.timeZone,
                generation: randomUUID(),
                expiresAt: new Date(Date.now() + 120000),
              },
            });
            for (const event of raw) {
              const reference = await tx.eventReference.upsert({
                where: {
                  sourceId_googleEventId: {
                    sourceId: source.id,
                    googleEventId: event.id,
                  },
                },
                create: { sourceId: source.id, googleEventId: event.id },
                update: {},
              });
              const mapped = normalizeGoogleEvent(
                event,
                source,
                connection,
                reference.id,
              );
              if (!mapped) continue;
              await tx.snapshotEvent.create({
                data: {
                  snapshotId: snapshot.id,
                  eventReferenceId: reference.id,
                  googleEventId: event.id,
                  startInstant: mapped.allDay ? null : new Date(mapped.start),
                  endInstant: mapped.allDay ? null : new Date(mapped.end),
                  startDate: mapped.allDay ? mapped.start : null,
                  endDate: mapped.allDay ? mapped.end : null,
                  data: JSON.parse(JSON.stringify(mapped)),
                },
              });
            }
            await tx.calendarSnapshot.updateMany({
              where: {
                sourceId: source.id,
                rangeStart: snapshot.rangeStart,
                rangeEnd: snapshot.rangeEnd,
                queryZone: job.timeZone,
                status: "active",
              },
              data: { status: "superseded" },
            });
            await tx.calendarSnapshot.update({
              where: { id: snapshot.id },
              data: { status: "active" },
            });
            await tx.calendarSource.update({
              where: { id: source.id },
              data: { lastError: null },
            });
          },
          { timeout: 120000 },
        );
      } catch (error) {
        if (error instanceof AppError && error.code === "REAUTH_REQUIRED")
          throw error;
        if (error instanceof AppError && error.code === "ACCESS_RESTRICTED") {
          await db().$transaction(async (tx) => {
            await tx.$executeRaw`SELECT id FROM "CalendarSource" WHERE id = ${source.id} FOR UPDATE`;
            await tx.calendarSource.updateMany({
              where: { id: source.id },
              data: {
                accessStatus: "restricted",
                accessStatusVersion: { increment: 1 },
                lastError: error.code,
              },
            });
            await tx.calendarSnapshot.deleteMany({
              where: { sourceId: source.id },
            });
          });
        } else {
          retryableFailure = error;
          await db().calendarSource.updateMany({
            where: { id: source.id },
            data: {
              lastError:
                error instanceof AppError ? error.code : "PROVIDER_UNAVAILABLE",
            },
          });
        }
      }
    }
    if (retryableFailure) throw retryableFailure;
    await db().googleConnection.updateMany({
      where: {
        id: connection.id,
        credentialVersion: connection.credentialVersion,
      },
      data: { lastError: null },
    });
  } catch (error) {
    const code =
      error instanceof AppError ? error.code : "PROVIDER_UNAVAILABLE";
    if (code === "REAUTH_REQUIRED")
      await db().googleConnection.updateMany({
        where: { id: connection.id },
        data: { status: "reconnect", lastError: code },
      });
    else if (code === "ACCESS_RESTRICTED") {
      await db().googleConnection.updateMany({
        where: {
          id: connection.id,
          credentialVersion: connection.credentialVersion,
        },
        data: { lastError: code },
      });
      await db().calendarSource.updateMany({
        where: { connectionId: connection.id },
        data: {
          accessStatus: "restricted",
          accessStatusVersion: { increment: 1 },
          lastError: code,
        },
      });
      await db().calendarSnapshot.deleteMany({
        where: { source: { connectionId: connection.id } },
      });
    } else
      await db().googleConnection.updateMany({
        where: { id: connection.id },
        data: { lastError: code },
      });
    if (
      code !== "REAUTH_REQUIRED" &&
      code !== "ACCESS_RESTRICTED" &&
      code !== "CALENDAR_API_DISABLED"
    )
      throw error;
  }
}
