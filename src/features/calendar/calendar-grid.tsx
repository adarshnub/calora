"use client";
import { useCallback, useMemo, useRef } from "react";
import FullCalendar, {
  type EventDisplayInfo,
  type DayHeaderInfo,
} from "@fullcalendar/react";
import themePlugin from "@fullcalendar/react/themes/monarch";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/monarch/theme.css";
import { useWorkspace } from "@/components/workspace";
import { formatTime, today } from "@/lib/shared/dates";
import type { Connection, EventGroup, TimeView } from "@/lib/shared/types";
import { AlertCircle, Video } from "lucide-react";
const plugins = [themePlugin, timeGridPlugin, dayGridPlugin, interactionPlugin];
const COLORS = {
  green: { background: "#eaf2e9", border: "#558264", text: "#284d35" },
  orange: { background: "#fff0e8", border: "#cb805d", text: "#7d442b" },
  purple: { background: "#f1ecf9", border: "#9981bd", text: "#5f4980" },
  blue: { background: "#eaf1fa", border: "#7091b9", text: "#3f5e83" },
};
const VIEWS = {
  week: "timeGridWeek",
  day: "timeGridDay",
  three: "timeGridThreeDay",
  month: "dayGridMonth",
  agenda: "timeGridWeek",
};
type Props = {
  events: EventGroup[];
  date: string;
  view: TimeView;
  compareAccounts?: Connection[];
  onOpen: (e: EventGroup) => void;
  onDateClick: (date: string) => void;
};
export default function CalendarGrid(props: Props) {
  const comparison = useRef<HTMLDivElement>(null),
    syncing = useRef(false);
  function syncScroll(e: React.UIEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (
      syncing.current ||
      !target ||
      target.clientHeight < 100 ||
      target.scrollHeight <= target.clientHeight + 20
    )
      return;
    const root = target.closest(".compare-grid");
    if (!root) return;
    syncing.current = true;
    comparison.current?.querySelectorAll(".compare-grid").forEach((grid) => {
      if (grid === root) return;
      const scroller = Array.from(grid.querySelectorAll<HTMLElement>("*")).find(
        (el) =>
          el.clientHeight > 100 &&
          el.scrollHeight > el.clientHeight + 20 &&
          ["auto", "scroll"].includes(getComputedStyle(el).overflowY),
      );
      if (scroller) scroller.scrollTop = target.scrollTop;
    });
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }
  if (props.compareAccounts)
    return (
      <div
        className="compare-grids"
        ref={comparison}
        onScrollCapture={syncScroll}
      >
        {props.compareAccounts.map((c) => (
          <div className="compare-grid" key={c.id}>
            <div className="compare-grid-label">
              <i className={`color-dot ${c.color}`} />
              <b>{c.label}</b>
              <small>{c.email}</small>
            </div>
            <Grid
              {...props}
              compareAccounts={undefined}
              events={props.events
                .filter((e) =>
                  e.copies.some((copy) => copy.connectionId === c.id),
                )
                .map((e) => {
                  const copies = e.copies.filter(
                    (copy) => copy.connectionId === c.id,
                  );
                  return {
                    ...copies[0],
                    id: e.id,
                    copies,
                    conflicts: e.conflicts,
                    variant: e.variant,
                  };
                })}
            />
          </div>
        ))}
      </div>
    );
  return <Grid {...props} />;
}
function Grid({ events, date, view, onOpen, onDateClick }: Props) {
  const { preferences } = useWorkspace();
  const input = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        color: COLORS[e.color]?.background ?? COLORS.green.background,
        textColor: COLORS[e.color]?.text ?? COLORS.green.text,
        extendedProps: { group: e },
        classNames: [
          "calora-event",
          `event-${e.color}`,
          e.conflicts.length ? "event-conflict" : "",
        ],
      })),
    [events],
  );
  const renderEvent = useCallback(
    (info: EventDisplayInfo) => {
      const e = info.event.extendedProps.group as EventGroup;
      return (
        <div
          className={`event-content color-${e.color} ${e.allDay ? "all-day-event" : Date.parse(e.end) - Date.parse(e.start) <= 3600000 ? "event-compact" : ""}`}
        >
          <div className="event-time">
            {!e.allDay
              ? `${formatTime(e.start, preferences.timeZone, preferences.clock)} – ${formatTime(e.end, preferences.timeZone, preferences.clock)}`
              : null}
            {e.conflicts.length ? <AlertCircle size={11} /> : null}
          </div>
          <span className="event-title">{e.title}</span>
          {!e.allDay ? (
            <div className="event-source">
              <span>{e.accountLabel}</span>
              {e.meetingUrl ? <Video size={12} /> : null}
              {e.copies.length > 1 ? <span>+{e.copies.length - 1}</span> : null}
            </div>
          ) : null}
        </div>
      );
    },
    [preferences.timeZone, preferences.clock],
  );
  const renderHeader = useCallback(
    (info: DayHeaderInfo) => {
      const d = info.date.toISOString().slice(0, 10);
      return (
        <div className={`grid-day-heading ${info.isToday ? "is-today" : ""}`}>
          <span>
            {info.weekdayText ||
              info.date.toLocaleDateString("en-US", {
                weekday: "short",
                timeZone: "UTC",
              })}
          </span>
          {view !== "month" ? (
            <b>{info.dayNumberText || info.date.getUTCDate()}</b>
          ) : null}
        </div>
      );
    },
    [view],
  );
  return (
    <div className={`full-calendar calendar-${view}`}>
      <FullCalendar
        key={`${view}-${date}-${preferences.timeZone}-${preferences.weekStart}-${preferences.showWeekends}`}
        plugins={plugins}
        initialView={VIEWS[view]}
        initialDate={date}
        views={{
          timeGridThreeDay: { type: "timeGrid", duration: { days: 3 } },
        }}
        class="calora-calendar-root"
        headerToolbar={false}
        footerToolbar={false}
        timeZone={preferences.timeZone}
        firstDay={preferences.weekStart}
        weekends={preferences.showWeekends}
        events={input}
        eventContent={renderEvent}
        eventClass={(info) =>
          `calora-event event-${(info.event.extendedProps.group as EventGroup).color}`
        }
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          onOpen(info.event.extendedProps.group as EventGroup);
        }}
        eventInteractive={true}
        eventDidMount={(info) => {
          info.el.setAttribute(
            "aria-label",
            `${info.event.title}, ${(info.event.extendedProps.group as EventGroup).accountLabel}`,
          );
        }}
        dayHeaderContent={renderHeader}
        dayHeaderClass="calora-day-header"
        dayCellClass={(info) => (info.isToday ? "calora-today" : "")}
        slotLaneClass="calora-slot"
        allDayHeaderContent="All day"
        allDayHeaderClass="calora-all-day-label"
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        scrollTime="08:00:00"
        slotDuration="00:30:00"
        slotMinHeight={24}
        slotHeaderInterval="01:00:00"
        slotHeaderClass="calora-time-header"
        slotHeaderInnerClass="calora-time-label"
        slotHeaderFormat={{
          hour: "numeric",
          minute: "2-digit",
          hour12: preferences.clock === "12",
          omitZeroMinute: true,
        }}
        eventTimeFormat={{
          hour: "numeric",
          minute: "2-digit",
          hour12: preferences.clock === "12",
        }}
        eventMinHeight={38}
        businessHours={{
          startTime: preferences.workingStart,
          endTime: preferences.workingEnd,
          daysOfWeek: [1, 2, 3, 4, 5],
        }}
        height="100%"
        nowIndicator={true}
        editable={false}
        selectable={false}
        dayMaxEvents={3}
        fixedWeekCount={true}
        dateClick={(info) => onDateClick(info.dateStr.slice(0, 10))}
      />
    </div>
  );
}
