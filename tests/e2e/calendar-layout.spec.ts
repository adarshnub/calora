import { test, expect } from "./fixtures";
import { fixtureEvents } from "../fixtures/calendar";

for (const width of [1872, 1536, 1024]) {
  test(`merged week keeps titles, headers, and late meetings usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const events = fixtureEvents("2026-10-26", "2026-11-02");
    const template = events.find((event) => !event.allDay)!;
    events.push(
      {
        ...template,
        id: "quick-sync",
        providerEventId: "quick-sync",
        title: "Quick sync",
        start: "2026-10-30T09:30:00+05:30",
        end: "2026-10-30T09:35:00+05:30",
      },
      {
        ...template,
        id: "check-in",
        providerEventId: "check-in",
        title: "Check-in",
        start: "2026-10-27T12:00:00+05:30",
        end: "2026-10-27T12:30:00+05:30",
      },
      {
        ...template,
        id: "late-call",
        providerEventId: "late-call",
        title: "Late call",
        start: "2026-10-27T23:00:00+05:30",
        end: "2026-10-27T23:30:00+05:30",
      },
      {
        ...template,
        id: "long-title",
        providerEventId: "long-title",
        title: "Customer conversations about the upcoming launch",
        start: "2026-10-29T11:00:00+05:30",
        end: "2026-10-29T12:00:00+05:30",
      },
    );
    await page.route("**/api/events?*", (route) =>
      route.fulfill({
        json: { events, sourceStatus: [], coverageComplete: true },
      }),
    );
    await page.goto("/?date=2026-10-27");
    await expect(page.locator(".calendar-week .grid-day-heading")).toHaveCount(
      7,
    );
    await expect(
      page.locator(".calora-event").filter({ hasText: "Quick sync" }),
    ).toHaveAttribute("title", /Quick sync.*Work/);
    for (const title of [
      "Quick sync",
      "Check-in",
      "Customer conversations",
      "Customer conversations about the upcoming launch",
    ]) {
      const card = page
        .locator(".calora-event")
        .filter({ hasText: title })
        .first();
      await expect(card).toBeVisible();
      const bounds = await card.evaluate((element) => {
        const title = element
          .querySelector(".event-title")!
          .getBoundingClientRect();
        const card = element.getBoundingClientRect();
        const metadata = Array.from(
          element.querySelectorAll<HTMLElement>(".event-time, .event-source"),
        ).filter((item) => getComputedStyle(item).display !== "none");
        return {
          titleTop: title.top,
          titleBottom: title.bottom,
          cardTop: card.top,
          cardBottom: card.bottom,
          metadataBottom: Math.max(
            title.bottom,
            ...metadata.map((item) => item.getBoundingClientRect().bottom),
          ),
        };
      });
      expect(bounds.titleTop).toBeGreaterThanOrEqual(bounds.cardTop);
      expect(bounds.titleBottom).toBeLessThanOrEqual(bounds.cardBottom + 1);
      expect(bounds.metadataBottom).toBeLessThanOrEqual(bounds.cardBottom + 1);
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight + 1 &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const heading = page.locator(".grid-day-heading.is-today");
    const before = await heading.boundingBox();
    await page.locator(".full-calendar").hover();
    await page.mouse.wheel(0, 2500);
    const late = page
      .locator(".calora-event")
      .filter({ hasText: "Late call" })
      .first();
    await expect(late).toBeInViewport();
    const after = await heading.boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    await late.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Late call", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
