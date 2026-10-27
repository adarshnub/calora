import type { CalendarEvent, Connection } from "../../src/lib/shared/types";
import { addDays, weekStart } from "../../src/lib/shared/dates";
export const DEMO_CONNECTIONS: Connection[] = [
  {
    id: "demo-work",
    label: "Work",
    email: "adarsh@studio.design",
    color: "green",
    status: "demo",
    sources: [
      {
        id: "demo-product",
        title: "Product",
        selected: true,
        primary: true,
        accessRole: "owner",
        accessStatus: "available",
      },
      {
        id: "demo-team",
        title: "Team",
        selected: true,
        primary: false,
        accessRole: "reader",
        accessStatus: "available",
      },
    ],
  },
  {
    id: "demo-personal",
    label: "Personal",
    email: "adarsh@gmail.com",
    color: "orange",
    status: "demo",
    sources: [
      {
        id: "demo-life",
        title: "Personal",
        selected: true,
        primary: true,
        accessRole: "owner",
        accessStatus: "available",
      },
      {
        id: "demo-birthdays",
        title: "Birthdays",
        selected: false,
        primary: false,
        accessRole: "reader",
        accessStatus: "available",
      },
    ],
  },
  {
    id: "demo-project",
    label: "Side project",
    email: "hello@calora.app",
    color: "purple",
    status: "demo",
    sources: [
      {
        id: "demo-side",
        title: "Calora",
        selected: true,
        primary: true,
        accessRole: "owner",
        accessStatus: "available",
      },
      {
        id: "demo-learning",
        title: "Learning",
        selected: true,
        primary: false,
        accessRole: "owner",
        accessStatus: "available",
      },
    ],
  },
];
// Fictional observations generated only on the server; never persisted in browser storage.
export function fixtureEvents(start: string, end: string): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  const add = (
    date: string,
    key: string,
    title: string,
    from: string,
    to: string,
    sourceId: string,
    extra: Partial<CalendarEvent> = {},
  ) => {
    const c = DEMO_CONNECTIONS.find((c) =>
      c.sources.some((s) => s.id === sourceId),
    )!;
    const s = c.sources.find((s) => s.id === sourceId)!;
    result.push({
      id: `${key}-${date}`,
      sourceId,
      connectionId: c.id,
      title,
      start: `${date}T${from}:00+05:30`,
      end: `${date}T${to}:00+05:30`,
      allDay: false,
      color: c.color,
      calendarTitle: s.title,
      accountLabel: c.label,
      accountEmail: c.email,
      response: "accepted",
      transparency: "opaque",
      status: "confirmed",
      organizer: "Alex Morgan",
      description:
        "A little space to connect, make progress, and focus on what matters. This is a fictional event in the Calora demo workspace.",
      attendees: [
        { name: "Adarsh", email: c.email, response: "accepted" },
        {
          name: "Alex Morgan",
          email: "alex@example.com",
          response: "accepted",
        },
      ],
      ...extra,
    });
  };
  for (
    let monday = weekStart(start);
    monday < end;
    monday = addDays(monday, 7)
  ) {
    add(monday, "plan", "Weekly planning", "09:00", "10:00", "demo-product", {
      location: "Studio · Meeting room 2",
      meetingUrl: "https://meet.google.com/",
      description:
        "Align on the week ahead.\n\n• Celebrate last week's progress\n• Review the product roadmap\n• Make room for the work that matters",
    });
    add(
      monday,
      "explore",
      "Website exploration",
      "15:00",
      "16:00",
      "demo-side",
      {
        location: "Figma",
        recurringEventId: "demo-series",
        iCalUID: "explore@demo",
        originalStart: `${monday}T15:00:00+05:30`,
      },
    );
    const tue = addDays(monday, 1);
    add(tue, "standup", "Design standup", "09:00", "09:45", "demo-team", {
      meetingUrl: "https://meet.google.com/",
      location: "Google Meet",
    });
    add(
      tue,
      "focus",
      "Deep work · mobile experience",
      "10:30",
      "12:00",
      "demo-product",
      {
        location: "Focus time",
        description:
          "Notifications off. A clear head and one thing at a time.\n\nExplore the mobile calendar flow, simplify navigation, and review touch targets.",
      },
    );
    add(tue, "lunch", "Lunch with Maya", "12:30", "13:30", "demo-life", {
      location: "The Greenhouse Café",
    });
    add(tue, "review", "Product review", "15:00", "16:00", "demo-product", {
      meetingUrl: "https://meet.google.com/",
      location: "Google Meet",
    });
    const wed = addDays(monday, 2);
    add(wed, "deep", "A little time to build", "09:30", "11:30", "demo-side", {
      location: "Focus time",
    });
    add(wed, "catchup", "Coffee & catch-up", "14:00", "15:00", "demo-life", {
      location: "Third Wave Coffee",
    });
    add(wed, "team", "Team sync", "16:00", "16:45", "demo-team", {
      meetingUrl: "https://meet.google.com/",
      location: "Google Meet",
    });
    const thu = addDays(monday, 3);
    add(
      thu,
      "research",
      "Customer conversations",
      "10:00",
      "11:00",
      "demo-product",
      { meetingUrl: "https://meet.google.com/", location: "Google Meet" },
    );
    add(thu, "dentist", "Dentist appointment", "13:00", "14:00", "demo-life", {
      location: "Smile Dental · Indiranagar",
    });
    add(thu, "overlap", "Brand direction", "13:30", "14:30", "demo-side", {
      meetingUrl: "https://meet.google.com/",
      location: "Google Meet",
    });
    const fri = addDays(monday, 4);
    add(fri, "demo", "Show & tell", "10:00", "11:00", "demo-team", {
      meetingUrl: "https://meet.google.com/",
      location: "Studio · The lounge",
    });
    add(fri, "read", "Read & recharge", "15:00", "16:30", "demo-learning", {
      location: "A quiet corner",
      description:
        "A good book, a cup of something warm, and no particular rush.",
    });
    add(
      addDays(monday, 5),
      "walk",
      "A slow Saturday morning",
      "09:00",
      "10:30",
      "demo-life",
      { location: "Cubbon Park" },
    );
    add(
      addDays(monday, 6),
      "reset",
      "Sunday reset",
      "17:00",
      "18:00",
      "demo-life",
      { location: "Home" },
    );
    add(
      monday,
      "launch",
      "Product launch week",
      "00:00",
      "00:00",
      "demo-product",
      {
        start: monday,
        end: addDays(monday, 5),
        allDay: true,
        transparency: "transparent",
        description:
          "A week of small launches and big ideas. Space for the team to bring it all together.",
      },
    );
  }
  return result;
}
