import { Temporal } from "temporal-polyfill";
import type { CalendarEvent, TimeView } from "./types";

export function addDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function addMonths(date: string, months: number) {
  return Temporal.PlainDate.from(date).add({ months }).toString();
}
export function today(zone = "Asia/Kolkata") {
  return Temporal.Now.plainDateISO(zone).toString();
}
export function weekStart(date: string, first: 0 | 1 = 1) {
  const day = Temporal.PlainDate.from(date).dayOfWeek % 7;
  return addDays(date, -((day - first + 7) % 7));
}
export function rangeFor(
  date: string,
  view: TimeView,
  first: 0 | 1 = 1,
): { start: string; end: string } {
  if (view === "week") {
    const start = weekStart(date, first);
    return { start, end: addDays(start, 7) };
  }
  if (view === "month") {
    const month = date.slice(0, 7) + "-01";
    const start = weekStart(month, first);
    return { start, end: addDays(start, 42) };
  }
  return {
    start: date,
    end: addDays(date, view === "agenda" ? 14 : view === "three" ? 3 : 1),
  };
}
export function localDate(instant: string, zone: string) {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
}
export function localTime(instant: string, zone: string) {
  const z = Temporal.Instant.from(instant).toZonedDateTimeISO(zone);
  return z.hour * 60 + z.minute;
}
export function dateInstant(date: string, zone: string) {
  return Temporal.PlainDate.from(date)
    .toZonedDateTime({ timeZone: zone, plainTime: "00:00" })
    .toInstant()
    .toString();
}
export function eventInRange(
  event: CalendarEvent,
  start: string,
  end: string,
  zone: string,
) {
  if (event.allDay) return event.start < end && event.end > start;
  return (
    Date.parse(event.start) < Date.parse(dateInstant(end, zone)) &&
    Date.parse(event.end) > Date.parse(dateInstant(start, zone))
  );
}
export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(date.slice(0, 10) + "T12:00:00Z"));
}
export function formatTime(
  value: string,
  zone: string,
  clock: "12" | "24" = "12",
) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: clock === "12",
  }).format(new Date(value));
}
export function duration(event: CalendarEvent) {
  if (event.allDay) {
    const n = Temporal.PlainDate.from(event.start).until(
      Temporal.PlainDate.from(event.end),
    ).days;
    return n === 1 ? "All day" : `${n} days`;
  }
  const mins = Math.round(
    (Date.parse(event.end) - Date.parse(event.start)) / 60000,
  );
  return mins >= 60
    ? `${Math.floor(mins / 60)} hr${mins % 60 ? ` ${mins % 60} min` : ""}`
    : `${mins} min`;
}
export function monthDays(date: string, first: 0 | 1 = 1) {
  const start = weekStart(date.slice(0, 7) + "-01", first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
export function rangeLabel(start: string, end: string) {
  const last = addDays(end, -1);
  if (start === last)
    return formatDate(start, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  return `${formatDate(start, { month: "long", day: "numeric" })} – ${formatDate(last, { ...(start.slice(0, 7) !== last.slice(0, 7) ? { month: "short" as const } : {}), day: "numeric" })}, ${last.slice(0, 4)}`;
}
