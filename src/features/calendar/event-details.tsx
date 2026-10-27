"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import {
  X,
  CalendarDays,
  Clock,
  Video,
  MapPin,
  Users,
  AlignLeft,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Repeat,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace";
import { Button, IconButton } from "@/components/ui";
import {
  duration,
  formatDate,
  formatTime,
  localDate,
} from "@/lib/shared/dates";
import { safeExternalUrl } from "@/lib/shared/calendar";
import type { EventGroup } from "@/lib/shared/types";
export function EventDetails({
  event,
  allEvents,
  onClose,
}: {
  event: EventGroup | null;
  allEvents: EventGroup[];
  onClose: () => void;
}) {
  const { preferences, notify } = useWorkspace();
  const [sourceIndex, setSourceIndex] = useState(0),
    [showAttendees, setShowAttendees] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setSourceIndex(0);
    setShowAttendees(false);
  }, [event?.id]);
  const data = event?.copies[sourceIndex] ?? event;
  const meeting = safeExternalUrl(data?.meetingUrl),
    original = safeExternalUrl(data?.htmlLink);
  return (
    <Dialog.Root
      open={!!event}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content
          className="event-drawer"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus();
          }}
        >
          <div className="drawer-topline">
            <span>EVENT DETAILS</span>
            <div>
              <IconButton
                label="Copy event summary"
                onClick={async () => {
                  if (!data) return;
                  try {
                    await navigator.clipboard.writeText(
                      `${data.title}\n${data.allDay ? data.start : formatDate(localDate(data.start, preferences.timeZone), { dateStyle: "long" })}\n${data.accountLabel} · ${data.calendarTitle}`,
                    );
                    notify("Event summary copied.");
                  } catch {
                    notify("Your browser couldn’t copy this event.");
                  }
                }}
              >
                <Copy size={16} />
              </IconButton>
              <Dialog.Close asChild>
                <IconButton label="Close event details">
                  <X size={19} />
                </IconButton>
              </Dialog.Close>
            </div>
          </div>
          {data && event ? (
            <>
              <div className={`drawer-event-color ${data.color}`}>
                <CalendarDays size={24} />
              </div>
              <Dialog.Title className="drawer-event-title">
                {data.title}
              </Dialog.Title>
              <Dialog.Description className="drawer-event-subtitle">
                <i className={`color-dot ${data.color}`} />
                {data.accountLabel}
                <span>/</span>
                {data.calendarTitle}
                {data.recurringEventId ? (
                  <Repeat size={13} aria-label="Recurring event" />
                ) : null}
              </Dialog.Description>
              {event.conflicts.length ? (
                <div className="event-conflict-notice">
                  <AlertCircle size={17} />
                  <div>
                    <b>This time overlaps</b>
                    {event.conflicts.map((id) => {
                      const other = allEvents.find((e) => e.id === id);
                      return other ? (
                        <span key={id}>
                          {other.title} · {other.accountLabel}
                          <small>
                            {formatTime(
                              other.start,
                              preferences.timeZone,
                              preferences.clock,
                            )}{" "}
                            –{" "}
                            {formatTime(
                              other.end,
                              preferences.timeZone,
                              preferences.clock,
                            )}
                          </small>
                        </span>
                      ) : null;
                    })}
                    <small>Based on the calendars selected in this view.</small>
                  </div>
                </div>
              ) : null}
              <div className="event-detail-rows">
                <div>
                  <CalendarDays size={18} />
                  <span>
                    <b>
                      {formatDate(
                        data.allDay
                          ? data.start
                          : localDate(data.start, preferences.timeZone),
                        {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </b>
                    {data.allDay ? (
                      <small>{duration(data)}</small>
                    ) : (
                      <small>
                        {formatTime(
                          data.start,
                          preferences.timeZone,
                          preferences.clock,
                        )}{" "}
                        –{" "}
                        {formatTime(
                          data.end,
                          preferences.timeZone,
                          preferences.clock,
                        )}
                        <span className="context-dot">·</span>
                        {duration(data)}
                      </small>
                    )}
                  </span>
                </div>
                <div>
                  <Clock size={18} />
                  <span>{preferences.timeZone.replaceAll("_", " ")}</span>
                </div>
              </div>
              {meeting ? (
                <div className="meeting-card">
                  <div>
                    <span className="meet-icon">
                      <Video size={19} />
                    </span>
                    <span>
                      <b>Google Meet</b>
                      <small>{new URL(meeting).host}</small>
                    </span>
                  </div>
                  <a
                    className="button primary"
                    href={meeting}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join meeting <ArrowUpRight size={16} />
                  </a>
                  <p>
                    Received by {data.accountEmail}. Check your account in Meet.
                  </p>
                </div>
              ) : null}
              {event.copies.length > 1 ? (
                <div className="source-observations">
                  <h3>Also on your calendar</h3>
                  <p>Details shown from the selected source below.</p>
                  {event.copies.map((copy, i) => (
                    <button
                      key={copy.id}
                      className={sourceIndex === i ? "active" : ""}
                      onClick={() => setSourceIndex(i)}
                    >
                      <i className={`color-dot ${copy.color}`} />
                      {copy.accountLabel} · {copy.calendarTitle}
                      <span>{copy.response}</span>
                      {i === sourceIndex ? <Check size={14} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {event.variant ? (
                <p className="variant-notice">
                  <AlertCircle size={14} />
                  Another source has different details for this occurrence. Both
                  versions are shown separately.
                </p>
              ) : null}
              <div className="event-detail-rows lower-rows">
                <div>
                  <Users size={18} />
                  <span>
                    <b>{data.organizer ?? "Calendar owner"}</b>
                    <small>Organizer</small>
                  </span>
                  <span className="response-badge">
                    <Check size={12} />
                    {data.response === "needsAction"
                      ? "Not responded"
                      : data.response}
                  </span>
                </div>
                {data.location ? (
                  <div>
                    <MapPin size={18} />
                    <span>{data.location}</span>
                  </div>
                ) : null}
                {data.description ? (
                  <div className="description-row">
                    <AlignLeft size={18} />
                    <span className="event-description">
                      {data.description}
                    </span>
                  </div>
                ) : null}
              </div>
              {data.attendees?.length ? (
                <div className="attendees">
                  <button
                    className="attendee-toggle"
                    onClick={() => setShowAttendees((v) => !v)}
                  >
                    <Users size={16} />
                    {data.attendees.length} guests{" "}
                    <span>{showAttendees ? "Hide" : "Show"}</span>
                  </button>
                  {showAttendees
                    ? data.attendees.map((a, i) => (
                        <div className="attendee" key={`${a.email}-${i}`}>
                          <span className="avatar avatar-tiny">
                            {a.name[0]}
                          </span>
                          <span>
                            <b>{a.name}</b>
                            <small>{a.email}</small>
                          </span>
                          <small>{a.response}</small>
                        </div>
                      ))
                    : null}
                </div>
              ) : null}
              <div className="drawer-footer">
                {original ? (
                  <a
                    href={original}
                    className="button"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Calendar <ExternalLink size={14} />
                  </a>
                ) : (
                  <span className="helper-text">
                    <ShieldCheck size={14} />
                    Read-only calendar event
                  </span>
                )}
                <span className="helper-text">
                  Your event stays in its original calendar.
                </span>
              </div>
            </>
          ) : (
            <Dialog.Title>Event unavailable</Dialog.Title>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
