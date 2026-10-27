export type Color = "green" | "orange" | "purple" | "blue";
export type TimeView = "week" | "day" | "three" | "month" | "agenda";
export type Presentation = "merged" | "account" | "compare";
export type CalendarSource = {
  id: string;
  title: string;
  selected: boolean;
  primary: boolean;
  accessRole: string;
  accessStatus: string;
};
export type Connection = {
  id: string;
  email: string;
  label: string;
  color: Color;
  status: string;
  lastError?: string | null;
  sources: CalendarSource[];
};
export type CalendarEvent = {
  id: string;
  sourceId: string;
  connectionId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: Color;
  calendarTitle: string;
  accountLabel: string;
  accountEmail: string;
  calendarKey?: string;
  providerEventId?: string;
  iCalUID?: string;
  recurringEventId?: string;
  originalStart?: string;
  description?: string;
  location?: string;
  organizer?: string;
  response: "accepted" | "declined" | "tentative" | "needsAction";
  transparency: "opaque" | "transparent";
  status: string;
  meetingUrl?: string;
  htmlLink?: string;
  attendees?: { name: string; email: string; response: string }[];
};
export type EventGroup = CalendarEvent & {
  copies: CalendarEvent[];
  conflicts: string[];
  variant: boolean;
};
export type SourceStatus = {
  sourceId: string;
  state: string;
  fetchedAt: string | null;
  coverage: boolean;
};
export type ScheduleResponse = {
  events: CalendarEvent[];
  sourceStatus: SourceStatus[];
  coverageComplete: boolean;
};
export type Preferences = {
  timeZone: string;
  clock: "12" | "24";
  weekStart: 0 | 1;
  appearance: "light" | "dark" | "system";
  groupDuplicates: boolean;
  showWeekends: boolean;
  workingStart: string;
  workingEnd: string;
  allDayBusy: boolean;
};
export const DEFAULT_PREFERENCES: Preferences = {
  timeZone: "Asia/Kolkata",
  clock: "12",
  weekStart: 1,
  appearance: "light",
  groupDuplicates: true,
  showWeekends: true,
  workingStart: "09:00",
  workingEnd: "18:00",
  allDayBusy: false,
};
export type SavedView = {
  id: string;
  name: string;
  sourceIds: string[];
  mode: Presentation;
};
