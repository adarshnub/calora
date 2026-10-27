"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, CalendarDays, ArrowUpRight, LoaderCircle } from "lucide-react";
import { Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { useSchedule } from "./use-schedule";
import { addDays, formatDate, formatTime, localDate } from "@/lib/shared/dates";
import { applyConnectionMetadata, groupEvents } from "@/lib/shared/calendar";
export function SearchResults({ onClose }: { onClose: () => void }) {
  const { date, preferences, selected, setDate, connections } = useWorkspace();
  const router = useRouter(),
    pathname = usePathname();
  const [term, setTerm] = useState(""),
    [debounced, setDebounced] = useState(""),
    [start, setStart] = useState(date),
    [end, setEnd] = useState(addDays(date, 14));
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 200);
    return () => clearTimeout(id);
  }, [term]);
  const valid =
    Date.parse(end) > Date.parse(start) &&
    (Date.parse(end) - Date.parse(start)) / 86400000 <= 62;
  const query = useSchedule(
    valid ? start : date,
    valid ? end : addDays(date, 14),
  );
  const results = useMemo(
    () =>
      groupEvents(
        applyConnectionMetadata(query.data?.events ?? [], connections),
        selected,
        preferences.groupDuplicates,
      )
        .filter((e) =>
          [e.title, e.location, e.calendarTitle, e.accountLabel]
            .join(" ")
            .toLowerCase()
            .includes(debounced.toLowerCase()),
        )
        .slice(0, 40),
    [query.data, connections, selected, preferences.groupDuplicates, debounced],
  );
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Find a little time."
      description="Search events in your selected calendars and date range."
      className="search-dialog"
    >
      <div className="search-input-wrap">
        <Search size={21} />
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="An event, a place, a calendar…"
          aria-label="Search calendar events"
        />
        <kbd>esc</kbd>
      </div>
      <div className="search-range">
        <CalendarDays size={15} />
        <label>
          From
          <input
            type="date"
            value={start}
            aria-label="Search start date"
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <span>to</span>
        <label>
          Until
          <input
            type="date"
            value={end}
            aria-label="Search end date (exclusive)"
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {!valid ? (
        <p role="alert" className="error-text">
          Choose a range of 1–62 days. The end date is exclusive.
        </p>
      ) : (
        <>
          <div className="search-results-label">
            <span>
              {debounced
                ? `${results.length} ${results.length === 1 ? "result" : "results"}`
                : "IN YOUR SCHEDULE"}
            </span>
            {query.isFetching ? (
              <LoaderCircle size={13} className="spin" />
            ) : (
              <small>
                {formatDate(start, { month: "short", day: "numeric" })} –{" "}
                {formatDate(addDays(end, -1), {
                  month: "short",
                  day: "numeric",
                })}
              </small>
            )}
          </div>
          <div className="search-results">
            {query.isError ? (
              <p className="search-no-results">
                Search is unavailable. Please try again.
              </p>
            ) : !query.isLoading && !results.length ? (
              <p className="search-no-results">
                {selected.length
                  ? "No matching events in this date range. Try a different phrase or range."
                  : "Select a calendar to search your events."}
              </p>
            ) : (
              results.map((event) => (
                <button
                  key={event.id}
                  onClick={() => {
                    const d = event.allDay
                      ? event.start
                      : localDate(event.start, preferences.timeZone);
                    setDate(d);
                    onClose();
                    if (pathname === "/")
                      window.dispatchEvent(
                        new CustomEvent("calora-open-event", {
                          detail: event.id,
                        }),
                      );
                    else
                      router.push(
                        `/?date=${d}&view=day&event=${encodeURIComponent(event.id)}`,
                      );
                  }}
                >
                  <span className={`search-event-icon ${event.color}`}>
                    <CalendarDays size={17} />
                  </span>
                  <span>
                    <b>{event.title}</b>
                    <small>
                      {formatDate(
                        event.allDay
                          ? event.start
                          : localDate(event.start, preferences.timeZone),
                        { month: "short", day: "numeric" },
                      )}{" "}
                      ·{" "}
                      {event.allDay
                        ? "All day"
                        : formatTime(
                            event.start,
                            preferences.timeZone,
                            preferences.clock,
                          )}{" "}
                      · {event.accountLabel}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))
            )}
          </div>
          <div className="search-footer">
            <span>Search covers this range only.</span>
            <span>
              <kbd>Tab</kbd> to navigate <kbd>↵</kbd> to open
            </span>
          </div>
        </>
      )}
    </Modal>
  );
}
