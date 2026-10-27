import { describe, it, expect } from "vitest";
import {
  detectConflicts,
  groupEvents,
  occurrenceKey,
  safeExternalUrl,
} from "@/lib/shared/calendar";
import {
  addDays,
  dateInstant,
  eventInRange,
  localDate,
  rangeFor,
  weekStart,
} from "@/lib/shared/dates";
import type { CalendarEvent } from "@/lib/shared/types";
const make = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "one",
  sourceId: "work",
  connectionId: "work-account",
  title: "Planning",
  start: "2026-10-27T09:00:00+05:30",
  end: "2026-10-27T10:00:00+05:30",
  allDay: false,
  color: "green",
  calendarTitle: "Product",
  accountLabel: "Work",
  accountEmail: "work@example.com",
  response: "accepted",
  transparency: "opaque",
  status: "confirmed",
  ...patch,
});
describe("source observations and duplicate identity", () => {
  it("filters before grouping, so richer hidden fields cannot leak", () => {
    const groups = groupEvents(
      [
        make({ iCalUID: "invite", description: "Work private" }),
        make({
          id: "two",
          sourceId: "personal",
          iCalUID: "invite",
          description: "Personal private",
        }),
      ],
      ["work"],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].description).toBe("Work private");
    expect(groups[0].copies).toHaveLength(1);
  });
  it("groups invitations across different Google calendars", () => {
    const groups = groupEvents(
      [
        make({ iCalUID: "invite", calendarKey: "work", providerEventId: "a" }),
        make({
          id: "two",
          sourceId: "personal",
          iCalUID: "invite",
          calendarKey: "personal",
          providerEventId: "b",
        }),
      ],
      ["work", "personal"],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].copies).toHaveLength(2);
  });
  it("groups one shared calendar accessed through two accounts", () =>
    expect(
      groupEvents(
        [
          make({ calendarKey: "shared", providerEventId: "a" }),
          make({
            id: "two",
            sourceId: "personal",
            calendarKey: "shared",
            providerEventId: "a",
          }),
        ],
        ["work", "personal"],
      ),
    ).toHaveLength(1));
  it("does not merge ordinary meetings with identical titles and visible times", () =>
    expect(groupEvents([make(), make({ id: "two" })], ["work"])).toHaveLength(
      2,
    ));
  it("distinguishes separate occurrences in one recurring series", () =>
    expect(
      occurrenceKey(
        make({
          iCalUID: "series",
          recurringEventId: "r",
          originalStart: "2026-10-27T09:00:00Z",
        }),
      ),
    ).not.toBe(
      occurrenceKey(
        make({
          iCalUID: "series",
          recurringEventId: "r",
          originalStart: "2026-11-03T09:00:00Z",
        }),
      ),
    ));
  it("normalizes the same original instant across different offsets", () =>
    expect(
      occurrenceKey(
        make({
          iCalUID: "series",
          recurringEventId: "r",
          originalStart: "2026-10-27T09:00:00Z",
        }),
      ),
    ).toBe(
      occurrenceKey(
        make({
          iCalUID: "series",
          recurringEventId: "r",
          originalStart: "2026-10-27T14:30:00+05:30",
        }),
      ),
    ));
  it("retains original identity when a recurring occurrence moves", () => {
    const base = make({
      iCalUID: "series",
      recurringEventId: "r",
      originalStart: "2026-10-27T09:00:00Z",
    });
    expect(occurrenceKey(base)).toBe(
      occurrenceKey({ ...base, start: "2026-10-28T09:00:00Z" }),
    );
  });
  it("keeps divergent source variants separate and marks them", () => {
    const groups = groupEvents(
      [
        make({ iCalUID: "invite" }),
        make({
          id: "two",
          sourceId: "personal",
          iCalUID: "invite",
          start: "2026-10-27T09:30:00+05:30",
        }),
      ],
      ["work", "personal"],
    );
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.variant)).toBe(true);
  });
  it("excludes canceled events", () =>
    expect(groupEvents([make({ status: "cancelled" })], ["work"])).toHaveLength(
      0,
    ));
});
describe("overlap detection", () => {
  it("uses half-open intervals for adjacent meetings", () => {
    const groups = groupEvents(
      [
        make(),
        make({
          id: "two",
          start: "2026-10-27T10:00:00+05:30",
          end: "2026-10-27T11:00:00+05:30",
        }),
      ],
      ["work"],
    );
    expect(detectConflicts(groups).every((g) => g.conflicts.length === 0)).toBe(
      true,
    );
  });
  it("finds overlapping commitments", () => {
    const groups = groupEvents(
      [make(), make({ id: "two", start: "2026-10-27T09:30:00+05:30" })],
      ["work"],
    );
    expect(detectConflicts(groups)[0].conflicts).toEqual(["two"]);
  });
  it.each([
    { response: "declined" as const },
    { transparency: "transparent" as const },
  ])("ignores declined or explicitly free copies (%o)", (patch) => {
    const groups = groupEvents(
      [make(), make({ id: "two", ...patch })],
      ["work"],
    );
    expect(detectConflicts(groups).every((g) => g.conflicts.length === 0)).toBe(
      true,
    );
  });
  it("an accepted copy remains busy when another selected account declines", () => {
    const groups = groupEvents(
      [
        make({ iCalUID: "shared", response: "declined" }),
        make({ id: "copy", sourceId: "personal", iCalUID: "shared" }),
        make({ id: "other" }),
      ],
      ["work", "personal"],
    );
    expect(
      detectConflicts(groups).find((e) => e.id === "other")?.conflicts,
    ).toHaveLength(1);
  });
  it("duplicate invitations never conflict with themselves even without grouping", () => {
    const groups = groupEvents(
      [
        make({ iCalUID: "shared" }),
        make({ id: "copy", sourceId: "personal", iCalUID: "shared" }),
      ],
      ["work", "personal"],
      false,
    );
    expect(detectConflicts(groups).every((g) => !g.conflicts.length)).toBe(
      true,
    );
  });
  it("all-day busy behavior is explicit", () => {
    const groups = groupEvents(
      [
        make(),
        make({
          id: "day",
          allDay: true,
          start: "2026-10-27",
          end: "2026-10-28",
        }),
      ],
      ["work"],
    );
    expect(detectConflicts(groups).every((g) => !g.conflicts.length)).toBe(
      true,
    );
    expect(detectConflicts(groups, true)[0].conflicts).toHaveLength(1);
  });
});
describe("typed dates and range semantics", () => {
  it("preserves all-day exclusive end dates", () => {
    const e = make({ allDay: true, start: "2026-10-27", end: "2026-10-28" });
    expect(
      eventInRange(e, "2026-10-27", "2026-10-28", "America/Los_Angeles"),
    ).toBe(true);
    expect(eventInRange(e, "2026-10-28", "2026-10-29", "Asia/Kolkata")).toBe(
      false,
    );
  });
  it("retains cross-midnight commitments", () =>
    expect(
      eventInRange(
        make({
          start: "2026-10-26T23:30:00+05:30",
          end: "2026-10-27T01:00:00+05:30",
        }),
        "2026-10-27",
        "2026-10-28",
        "Asia/Kolkata",
      ),
    ).toBe(true));
  it("maps instants into the requested local day", () =>
    expect(localDate("2026-10-27T00:30:00Z", "America/Los_Angeles")).toBe(
      "2026-10-26",
    ));
  it("uses a 25-hour day across the end of daylight saving", () =>
    expect(
      (Date.parse(dateInstant("2026-11-02", "America/New_York")) -
        Date.parse(dateInstant("2026-11-01", "America/New_York"))) /
        3600000,
    ).toBe(25));
  it("preserves wall time when provider-expanded recurrences cross DST", () => {
    const before = make({ start: "2026-10-26T09:00:00-04:00" }),
      after = make({ start: "2026-11-02T09:00:00-05:00" });
    expect(
      new Date(after.start).getTime() - new Date(before.start).getTime(),
    ).toBe(7 * 86400000 + 3600000);
  });
  it("supports Sunday and Monday week starts", () => {
    expect(weekStart("2026-10-27", 1)).toBe("2026-10-26");
    expect(weekStart("2026-10-27", 0)).toBe("2026-10-25");
    expect(rangeFor("2026-10-27", "agenda").end).toBe("2026-11-10");
  });
  it("rejects unsafe external links", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("data:text/html,test")).toBeUndefined();
    expect(safeExternalUrl("https://meet.google.com/abc")).toBe(
      "https://meet.google.com/abc",
    );
  });
});
