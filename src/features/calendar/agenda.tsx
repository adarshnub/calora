"use client";
import {
  CalendarDays,
  ArrowRight,
  Video,
  MapPin,
  AlertCircle,
  Sun,
} from "lucide-react";
import { useMemo } from "react";
import { Button, EmptyState } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import {
  addDays,
  duration,
  eventInRange,
  formatDate,
  formatTime,
  monthDays,
  today,
} from "@/lib/shared/dates";
import type { EventGroup } from "@/lib/shared/types";
import { safeExternalUrl } from "@/lib/shared/calendar";
type Props = {
  events: EventGroup[];
  start: string;
  end: string;
  onOpen: (e: EventGroup) => void;
  onExtend?: () => void;
  coverageComplete?: boolean;
};
export function Agenda({
  events,
  start,
  end,
  onOpen,
  onExtend,
  coverageComplete = true,
}: Props) {
  const { preferences } = useWorkspace();
  const days = useMemo(() => {
    const result: string[] = [];
    for (let d = start; d < end; d = addDays(d, 1)) result.push(d);
    return result;
  }, [start, end]);
  const nonempty = days.filter((d) =>
    events.some((e) => eventInRange(e, d, addDays(d, 1), preferences.timeZone)),
  );
  if (!events.length)
    return (
      <EmptyState
        icon={<Sun size={27} strokeWidth={1.4} />}
        heading={
          coverageComplete
            ? "A little breathing room."
            : "Still bringing your day together."
        }
      >
        {coverageComplete
          ? "No events in your selected calendars for this date range."
          : "Some calendar data is unavailable. We can’t confirm your schedule yet."}
      </EmptyState>
    );
  return (
    <div className="agenda-list">
      {nonempty.map((day) => {
        const rows = events.filter((e) =>
          eventInRange(e, day, addDays(day, 1), preferences.timeZone),
        );
        return (
          <section key={day} className="agenda-day">
            <div
              className={`agenda-date ${day === today(preferences.timeZone) ? "today" : ""}`}
            >
              <span>{formatDate(day, { weekday: "short" })}</span>
              <b>{Number(day.slice(-2))}</b>
              <small>{formatDate(day, { month: "short" })}</small>
            </div>
            <div className="agenda-day-events">
              <div className="agenda-date-label">
                {day === today(preferences.timeZone) ? "Today · " : ""}
                {formatDate(day, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                <span>
                  {rows.length} {rows.length === 1 ? "event" : "events"}
                </span>
              </div>
              {rows
                .sort(
                  (a, b) =>
                    Number(b.allDay) - Number(a.allDay) ||
                    a.start.localeCompare(b.start),
                )
                .map((event) => (
                  <div
                    className={`agenda-event event-${event.color}`}
                    key={`${day}-${event.id}`}
                  >
                    <button
                      className="agenda-event-open"
                      onClick={() => onOpen(event)}
                    >
                      <div className="agenda-time">
                        <b>
                          {event.allDay
                            ? "All day"
                            : formatTime(
                                event.start,
                                preferences.timeZone,
                                preferences.clock,
                              )}
                        </b>
                        <small>
                          {event.allDay
                            ? ""
                            : formatTime(
                                event.end,
                                preferences.timeZone,
                                preferences.clock,
                              )}
                        </small>
                      </div>
                      <div className="agenda-event-info">
                        <div className="agenda-event-title">
                          {event.title}
                          {event.conflicts.length ? (
                            <span className="overlap-label">
                              <AlertCircle size={12} />
                              Overlap
                            </span>
                          ) : null}
                        </div>
                        <div className="agenda-event-meta">
                          <span className="account-tag">
                            <i className={`color-dot ${event.color}`} />
                            {event.accountLabel}{" "}
                            <span className="context-dot">/</span>{" "}
                            {event.calendarTitle}
                          </span>
                          {event.location ? (
                            <span className="agenda-location">
                              {event.meetingUrl ? (
                                <Video size={12} />
                              ) : (
                                <MapPin size={12} />
                              )}{" "}
                              {event.location}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                    {safeExternalUrl(event.meetingUrl) ? (
                      <a
                        className="join-button"
                        href={safeExternalUrl(event.meetingUrl)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Join ${event.title}`}
                      >
                        <Video size={14} />
                        <span>Join</span>
                      </a>
                    ) : (
                      <span className="agenda-duration">{duration(event)}</span>
                    )}
                  </div>
                ))}
            </div>
          </section>
        );
      })}
      {onExtend ? (
        <div className="agenda-load-more">
          <Button onClick={onExtend}>
            Show next two weeks <ArrowRight size={15} />
          </Button>
          <p>Your schedule, at your pace.</p>
        </div>
      ) : null}
    </div>
  );
}
export function MobileMonth({
  date,
  events,
  onOpen,
}: {
  date: string;
  events: EventGroup[];
  onOpen: (e: EventGroup) => void;
}) {
  const { preferences, setDate } = useWorkspace();
  const days = monthDays(date, preferences.weekStart);
  return (
    <div className="mobile-month">
      <div className="mobile-month-grid">
        {(preferences.weekStart === 1
          ? ["M", "T", "W", "T", "F", "S", "S"]
          : ["S", "M", "T", "W", "T", "F", "S"]
        ).map((d, i) => (
          <span key={i} className="month-weekday">
            {d}
          </span>
        ))}
        {days.map((day) => {
          const items = events.filter((e) =>
            eventInRange(e, day, addDays(day, 1), preferences.timeZone),
          );
          return (
            <button
              key={day}
              aria-label={`${formatDate(day, { dateStyle: "full" })}, ${items.length} events`}
              aria-pressed={day === date}
              className={`${day === date ? "active" : ""} ${day.slice(0, 7) !== date.slice(0, 7) ? "outside" : ""}`}
              onClick={() => setDate(day)}
            >
              <b>{Number(day.slice(-2))}</b>
              <span>
                {[...new Set(items.map((e) => e.color))]
                  .slice(0, 3)
                  .map((c) => (
                    <i className={`color-dot ${c}`} key={c} />
                  ))}
              </span>
            </button>
          );
        })}
      </div>
      <Agenda
        events={events.filter((e) =>
          eventInRange(e, date, addDays(date, 1), preferences.timeZone),
        )}
        start={date}
        end={addDays(date, 1)}
        onOpen={onOpen}
      />
    </div>
  );
}
