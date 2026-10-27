import type { CalendarEvent, EventGroup, Connection } from "./types";
import { dateInstant } from "./dates";

export function occurrenceKey(event: CalendarEvent) {
  if (event.iCalUID) {
    if (event.recurringEventId && !event.originalStart)
      return `unique:${event.id}`;
    const original = event.originalStart;
    return `ical:${event.iCalUID}:${original ? (original.length === 10 ? `date:${original}` : `instant:${new Date(original).toISOString()}`) : "single"}`;
  }
  if (event.calendarKey && event.providerEventId)
    return `calendar:${event.calendarKey}:${event.providerEventId}`;
  return `unique:${event.id}`;
}
function materialKey(event: CalendarEvent) {
  return [event.start, event.end, event.title, event.organizer ?? ""].join("|");
}
export function groupEvents(
  events: CalendarEvent[],
  selected: string[],
  group = true,
): EventGroup[] {
  const sources = new Set(selected);
  const groups = new Map<string, EventGroup>();
  // Filter observations before grouping: hidden accounts cannot contribute fields.
  for (const event of events) {
    if (!sources.has(event.sourceId) || event.status === "cancelled") continue;
    const identity = group ? occurrenceKey(event) : event.id;
    const key = identity + "|" + materialKey(event);
    const existing = groups.get(key);
    if (existing) existing.copies.push(event);
    else
      groups.set(key, {
        ...event,
        copies: [event],
        conflicts: [],
        variant: false,
      });
  }
  const result = [...groups.values()];
  const identities = new Map<string, number>();
  for (const e of result)
    identities.set(
      occurrenceKey(e),
      (identities.get(occurrenceKey(e)) ?? 0) + 1,
    );
  for (const e of result)
    e.variant = (identities.get(occurrenceKey(e)) ?? 0) > 1;
  return result.sort((a, b) => a.start.localeCompare(b.start));
}
export function detectConflicts(
  groups: EventGroup[],
  allDayBusy = false,
  zone = "Asia/Kolkata",
) {
  const result = groups.map((e) => ({ ...e, conflicts: [] as string[] }));
  const intervals = result
    .filter(
      (e) =>
        (!e.allDay || allDayBusy) &&
        e.copies.some(
          (c) =>
            c.response !== "declined" &&
            c.transparency !== "transparent" &&
            c.status !== "cancelled",
        ),
    )
    .map((event) => ({
      event,
      start: Date.parse(
        event.allDay ? dateInstant(event.start, zone) : event.start,
      ),
      end: Date.parse(event.allDay ? dateInstant(event.end, zone) : event.end),
    }))
    .sort((a, b) => a.start - b.start);
  let active: typeof intervals = [];
  for (const current of intervals) {
    active = active.filter((a) => a.end > current.start);
    for (const previous of active) {
      if (occurrenceKey(previous.event) === occurrenceKey(current.event))
        continue;
      previous.event.conflicts.push(current.event.id);
      current.event.conflicts.push(previous.event.id);
    }
    active.push(current);
  }
  return result;
}
export function safeExternalUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function applyConnectionMetadata(
  events: CalendarEvent[],
  connections: Connection[],
) {
  const byId = new Map(connections.map((c) => [c.id, c]));
  return events.flatMap((event) => {
    const c = byId.get(event.connectionId);
    if (!c) return [];
    return [
      {
        ...event,
        color: c.color,
        accountLabel: c.label,
        accountEmail: c.email,
      },
    ];
  });
}
