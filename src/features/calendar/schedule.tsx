"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  RefreshCw,
  CalendarDays,
  Check,
  Search,
  ArrowUpRight,
  AlertCircle,
  Layers,
  Columns2,
  Sun,
  ArrowRight,
} from "lucide-react";
import { api, useWorkspace } from "@/components/workspace";
import {
  Button,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
} from "@/components/ui";
import {
  addDays,
  addMonths,
  formatDate,
  rangeFor,
  rangeLabel,
  today,
  weekStart,
} from "@/lib/shared/dates";
import {
  applyConnectionMetadata,
  detectConflicts,
  groupEvents,
} from "@/lib/shared/calendar";
import type { EventGroup, Presentation, TimeView } from "@/lib/shared/types";
import { useSchedule } from "./use-schedule";
import { Agenda, MobileMonth } from "./agenda";
import { EventDetails } from "./event-details";
const CalendarGrid = dynamic(() => import("./calendar-grid"), {
  ssr: false,
  loading: () => <CalendarSkeleton />,
});
export const VIEW_NAMES: Record<TimeView, string> = {
  week: "Week",
  day: "Day",
  three: "3 days",
  month: "Month",
  agenda: "Agenda",
};
export function Schedule() {
  const workspace = useWorkspace();
  const {
    connections,
    preferences,
    date,
    setDate,
    selected,
    connect,
    openFilters,
    openSearch,
    setupRequired,
    notify,
  } = workspace;
  const [agendaPages, setAgendaPages] = useState(1);
  const [view, setViewState] = useState<TimeView>("week"),
    [mode, setModeState] = useState<Presentation>("merged"),
    [mobile, setMobile] = useState(false),
    [ready, setReady] = useState(false);
  const [account, setAccount] = useState(connections[0]?.id ?? ""),
    [compare, setCompare] = useState<[string, string]>([
      connections[0]?.id ?? "",
      connections[1]?.id ?? "",
    ]);
  const [eventId, setEventId] = useState<string | null>(null),
    [refreshing, setRefreshing] = useState(false),
    [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const openedWithPush = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const change = (initial = false) => {
      setMobile(media.matches);
      const urlView = initial
        ? new URLSearchParams(window.location.search).get("view")
        : null;
      const saved = localStorage.getItem(
        `calora-view-${media.matches ? "mobile" : "desktop"}`,
      );
      const nextView =
        urlView && urlView in VIEW_NAMES
          ? (urlView as TimeView)
          : saved && saved in VIEW_NAMES
            ? (saved as TimeView)
            : media.matches
              ? "agenda"
              : "week";
      setViewState(nextView);
      if (!initial) {
        const url = new URL(window.location.href);
        url.searchParams.set("view", nextView);
        window.history.replaceState(null, "", url);
      }
    };
    change(true);
    const changeViewport = () => change(false);
    const params = new URLSearchParams(window.location.search),
      m = params.get("mode");
    if (m && ["merged", "account", "compare"].includes(m))
      setModeState(m as Presentation);
    setEventId(params.get("event"));
    setReady(true);
    media.addEventListener("change", changeViewport);
    const setModeEvent = (e: Event) => setModeState((e as CustomEvent).detail);
    window.addEventListener("calora-mode", setModeEvent);
    return () => {
      media.removeEventListener("change", changeViewport);
      window.removeEventListener("calora-mode", setModeEvent);
    };
  }, []);
  useEffect(() => {
    if (!connections.some((c) => c.id === account))
      setAccount(connections[0]?.id ?? "");
    setCompare((previous) => [
      connections.some((c) => c.id === previous[0])
        ? previous[0]
        : (connections[0]?.id ?? ""),
      connections.some((c) => c.id === previous[1])
        ? previous[1]
        : (connections[1]?.id ?? ""),
    ]);
  }, [connections, account]);
  const setView = useCallback(
    (v: TimeView) => {
      setViewState(v);
      localStorage.setItem(`calora-view-${mobile ? "mobile" : "desktop"}`, v);
      const url = new URL(window.location.href);
      url.searchParams.set("view", v);
      window.history.replaceState(null, "", url);
    },
    [mobile],
  );
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setEventId(id);
      setView("day");
      setModeState("merged");
      const url = new URL(window.location.href);
      url.searchParams.set("event", id);
      url.searchParams.set("mode", "merged");
      window.history.pushState(null, "", url);
      openedWithPush.current = true;
    };
    window.addEventListener("calora-open-event", handler);
    return () => window.removeEventListener("calora-open-event", handler);
  }, [setView]);
  function setMode(m: Presentation) {
    setModeState(m);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", m);
    window.history.replaceState(null, "", url);
  }
  const baseRange = rangeFor(
    date,
    mode === "compare" ? "day" : view,
    preferences.weekStart,
  );
  const visibleRange =
    view === "agenda" && mode !== "compare"
      ? { start: date, end: addDays(date, 14 * agendaPages) }
      : baseRange;
  const query = useSchedule(visibleRange.start, visibleRange.end);
  const selectedForMode = useMemo(
    () =>
      mode === "account"
        ? selected.filter((id) =>
            connections
              .find((c) => c.id === account)
              ?.sources.some((s) => s.id === id),
          )
        : mode === "compare"
          ? selected.filter((id) =>
              connections
                .filter((c) => compare.includes(c.id))
                .some((c) => c.sources.some((s) => s.id === id)),
            )
          : selected,
    [mode, selected, connections, account, compare],
  );
  const events = useMemo(
    () =>
      detectConflicts(
        groupEvents(
          applyConnectionMetadata(query.data?.events ?? [], connections),
          selectedForMode,
          preferences.groupDuplicates,
        ),
        preferences.allDayBusy,
        preferences.timeZone,
      ),
    [
      query.data,
      connections,
      selectedForMode,
      preferences.groupDuplicates,
      preferences.allDayBusy,
      preferences.timeZone,
    ],
  );
  const activeEvent = events.find((e) => e.id === eventId);
  const openEvent = useCallback((event: EventGroup) => {
    setEventId(event.id);
    const url = new URL(window.location.href);
    url.searchParams.set("event", event.id);
    window.history.pushState(null, "", url);
    openedWithPush.current = true;
  }, []);
  const closeEvent = useCallback(() => {
    setEventId(null);
    if (openedWithPush.current) {
      window.history.back();
      openedWithPush.current = false;
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("event");
      window.history.replaceState(null, "", url);
    }
  }, []);
  useEffect(() => {
    const pop = () => {
      const params = new URLSearchParams(window.location.search);
      setEventId(params.get("event"));
      const d = params.get("date");
      if (d) setDate(d);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [setDate]);
  const move = useCallback(
    (direction: number) => {
      if (view === "month" && mode !== "compare")
        setDate(addMonths(date, direction));
      else
        setDate(
          addDays(
            date,
            direction *
              (mode === "compare"
                ? 1
                : view === "week"
                  ? 7
                  : view === "three"
                    ? 3
                    : view === "agenda"
                      ? 14
                      : 1),
          ),
        );
    },
    [date, view, mode, setDate],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (e.key === "t") {
        setDate(today(preferences.timeZone));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      }
      if (e.key === "w") setView("week");
      if (e.key === "m") setView("month");
      if (e.key === "a") setView("agenda");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move, setDate, setView, preferences.timeZone]);
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (!setupRequired)
        await api("/api/sync", {
          method: "POST",
          body: JSON.stringify({
            ...visibleRange,
            timeZone: preferences.timeZone,
          }),
        });
      await query.refetch();
      setLastRefresh(
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      );
      notify(
        setupRequired
          ? "Connect an account to start syncing your calendars."
          : "Refresh queued. Your calendar sources will update as they finish.",
      );
    } catch {
      notify(
        "Couldn’t refresh right now. Your last available schedule is still here.",
      );
    } finally {
      setRefreshing(false);
    }
  }
  const count = connections.filter((c) =>
    c.sources.some((s) => selected.includes(s.id)),
  ).length;
  const conflictCount = events.filter((e) => e.conflicts.length).length;
  const calendarName =
    mode === "compare"
      ? formatDate(date, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : view === "month"
        ? formatDate(date, { month: "long", year: "numeric" })
        : rangeLabel(visibleRange.start, visibleRange.end);
  const incomplete = query.data && !query.data.coverageComplete;
  return (
    <div className="schedule-page">
      <section className="page-heading">
        <div>
          <h1>
            Your time, together<span className="heading-period">.</span>
          </h1>
          <p>A clear view of every part of your day.</p>
        </div>
        <Button
          variant="primary"
          aria-label="Connect account"
          onClick={() => connect()}
        >
          <Plus size={17} />
          <span>Connect account</span>
        </Button>
      </section>
      <section className="schedule-toolbar" aria-label="Calendar controls">
        <div className="date-controls">
          <Button
            className="today-button"
            onClick={() => setDate(today(preferences.timeZone))}
          >
            Today
          </Button>
          <div className="date-arrows">
            <IconButton label="Previous period" onClick={() => move(-1)}>
              <ChevronLeft size={18} />
            </IconButton>
            <IconButton label="Next period" onClick={() => move(1)}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
          <label className="date-title">
            <span>{calendarName}</span>
            <ChevronDown size={14} />
            <input
              type="date"
              value={date}
              aria-label="Choose calendar date"
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
        </div>
        <div className="view-controls">
          <div className="presentation-switch" aria-label="Presentation mode">
            {(
              [
                ["merged", "Merged"],
                ["account", "By account"],
                ["compare", "Compare"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={mode === key ? "active" : ""}
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <Menu
            trigger={
              <Button className="view-button">
                {mode === "compare" ? "Day" : VIEW_NAMES[view]}
                <ChevronDown size={14} />
              </Button>
            }
          >
            {(Object.keys(VIEW_NAMES) as TimeView[])
              .filter((v) => !mobile || v !== "three")
              .map((v) => (
                <MenuItem
                  key={v}
                  onSelect={() => {
                    setView(v);
                    if (mode === "compare") setMode("merged");
                  }}
                >
                  <span className="menu-check">
                    {view === v ? <Check size={14} /> : null}
                  </span>
                  {VIEW_NAMES[v]}
                  <kbd>
                    {v === "week"
                      ? "W"
                      : v === "month"
                        ? "M"
                        : v === "agenda"
                          ? "A"
                          : ""}
                  </kbd>
                </MenuItem>
              ))}
          </Menu>
          <IconButton label="Choose calendars" onClick={openFilters}>
            <SlidersHorizontal size={17} />
          </IconButton>
        </div>
      </section>
      <div className="calendar-context">
        <div className="selection-summary">
          <span className="stacked-dots">
            {connections
              .filter((c) => c.sources.some((s) => selected.includes(s.id)))
              .map((c) => (
                <i className={c.color} key={c.id} />
              ))}
          </span>
          <span>
            {count} {count === 1 ? "account" : "accounts"}
            <span className="context-dot">·</span>
            {selected.length} calendars
          </span>
          {conflictCount > 0 ? (
            <button
              className="conflict-summary"
              onClick={() => {
                setView("agenda");
                notify("Overlapping events are marked in your agenda.");
              }}
            >
              <AlertCircle size={13} />
              {conflictCount / 2 < 1 ? 1 : Math.ceil(conflictCount / 2)} overlap
            </button>
          ) : null}
        </div>
        <div className="freshness">
          <button
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh calendars"
            title={
              lastRefresh
                ? `Last refreshed ${lastRefresh}`
                : "Refresh calendars"
            }
          >
            <RefreshCw
              size={13}
              className={refreshing || query.isFetching ? "spin" : ""}
            />
            <span>
              {refreshing
                ? "Updating…"
                : !connections.length
                  ? "No accounts connected"
                  : query.isFetching
                    ? "Updating…"
                    : incomplete
                      ? "Partial coverage"
                      : "Up to date"}
            </span>
          </button>
          <span className="timezone-label">
            {preferences.timeZone.replaceAll("_", " ")}
          </span>
        </div>
      </div>
      {mode === "account" ? (
        <div className="account-view-controls">
          <span>A little focus on</span>
          {connections.map((c) => (
            <button
              key={c.id}
              className={`account-tab ${account === c.id ? "active" : ""}`}
              onClick={() => setAccount(c.id)}
            >
              <i className={`color-dot ${c.color}`} />
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
      {mode === "compare" ? (
        <div className="compare-controls">
          <Columns2 size={16} />
          <span>Side by side</span>
          <select
            aria-label="First comparison account"
            value={compare[0]}
            onChange={(e) =>
              setCompare([
                e.target.value,
                compare[1] === e.target.value
                  ? (connections.find((c) => c.id !== e.target.value)?.id ?? "")
                  : compare[1],
              ])
            }
          >
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <span className="muted">and</span>
          <select
            aria-label="Second comparison account"
            value={compare[1]}
            onChange={(e) => setCompare([compare[0], e.target.value])}
          >
            {connections
              .filter((c) => c.id !== compare[0])
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </select>
          {mobile ? (
            <small>
              A merged agenda keeps both accounts readable on your screen.
            </small>
          ) : null}
        </div>
      ) : null}
      {mobile ? (
        <div className="mobile-date-strip">
          {Array.from({ length: 7 }, (_, i) =>
            addDays(weekStart(date, preferences.weekStart), i),
          ).map((d) => (
            <button
              key={d}
              className={date === d ? "active" : ""}
              aria-pressed={date === d}
              onClick={() => setDate(d)}
            >
              <small>{formatDate(d, { weekday: "short" })}</small>
              <b>{Number(d.slice(-2))}</b>
              <span className={d === today() ? "date-today-dot" : ""} />
            </button>
          ))}
        </div>
      ) : null}
      {incomplete ? (
        <div role="status" className="coverage-warning">
          <AlertCircle size={16} />
          <span>
            Some calendars are still loading or need attention. Your full
            availability is not confirmed.
          </span>
          <button onClick={() => workspace.connect()}>
            Review accounts <ArrowUpRight size={13} />
          </button>
        </div>
      ) : null}
      <div
        className={`calendar-body ${view === "agenda" ? "agenda-body" : ""}`}
      >
        {!connections.length ? (
          <EmptyState
            icon={<Layers size={26} />}
            heading="Every part of your day, in one place."
            action={
              <Button variant="primary" onClick={() => connect()}>
                <Plus size={16} />
                Connect your first account
              </Button>
            }
          >
            Connect a Google account to bring your calendars together.
          </EmptyState>
        ) : selectedForMode.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={25} />}
            heading="A little too quiet?"
            action={
              <Button onClick={openFilters}>
                <SlidersHorizontal size={16} />
                Choose calendars
              </Button>
            }
          >
            Your filters are hiding every calendar in this view. Choose a few to
            bring your schedule back.
          </EmptyState>
        ) : query.isError ? (
          <EmptyState
            icon={<AlertCircle size={25} />}
            heading="Your schedule needs a moment."
            action={<Button onClick={() => query.refetch()}>Try again</Button>}
          >
            We couldn’t load these calendars. Your availability hasn’t been
            confirmed.
          </EmptyState>
        ) : query.isLoading || !ready ? (
          <CalendarSkeleton />
        ) : mobile && view === "month" ? (
          <MobileMonth date={date} events={events} onOpen={openEvent} />
        ) : view === "agenda" || (mobile && mode === "compare") ? (
          <Agenda
            events={events}
            start={visibleRange.start}
            end={visibleRange.end}
            onOpen={openEvent}
            onExtend={
              agendaPages < 4 ? () => setAgendaPages((p) => p + 1) : undefined
            }
            coverageComplete={query.data?.coverageComplete ?? false}
          />
        ) : mode === "compare" && connections.length < 2 ? (
          <EmptyState
            icon={<Columns2 size={25} />}
            heading="Two perspectives. One day."
            action={
              <Button onClick={() => connect()}>Connect another account</Button>
            }
          >
            Connect at least two accounts to compare their schedules.
          </EmptyState>
        ) : (
          <CalendarGrid
            events={events}
            date={date}
            view={mode === "compare" ? "day" : view}
            compareAccounts={
              mode === "compare"
                ? connections.filter((c) => compare.includes(c.id))
                : undefined
            }
            onOpen={openEvent}
            onDateClick={(d) => {
              setDate(d);
              setView("day");
            }}
          />
        )}
      </div>
      <footer className="calendar-footer">
        <span>
          <i className="footer-dot" />A little more room for what matters.
        </span>
        <span>
          All times in {preferences.timeZone}
          <span className="footer-key">T</span> for today
        </span>
      </footer>
      <EventDetails
        event={activeEvent ?? null}
        allEvents={events}
        onClose={closeEvent}
      />
    </div>
  );
}
export function CalendarSkeleton() {
  return (
    <div
      className="calendar-skeleton"
      aria-label="Loading calendar"
      role="status"
    >
      <div className="skeleton-days">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className="skeleton-lines">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} />
        ))}
      </div>
      <span className="sr-only">Loading your schedule</span>
    </div>
  );
}
