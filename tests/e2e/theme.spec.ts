import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
async function dark(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("calora-appearance-v1", "dark"),
  );
}
async function contrast(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      function lum(c: string) {
        const n = c
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
        return n[0] * 0.2126 + n[1] * 0.7152 + n[2] * 0.0722;
      }
      const s = getComputedStyle(el);
      const fg = lum(s.color),
        bg = lum(s.backgroundColor);
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    });
}
test("dark calendar has dark grid surfaces and readable event colors in every time view", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await dark(page);
  await page.goto("/?date=2026-10-27");
  await expect(page.locator(".calora-event").first()).toBeVisible();
  for (const view of ["Week", "Day", "3 days", "Month"]) {
    if (view !== "Week") {
      await page.locator(".view-button").click();
      await page
        .getByRole("menuitem", { name: new RegExp(`^${view}`) })
        .click();
    }
    await expect(page.locator(".full-calendar")).toBeVisible();
    const bright = await page.locator(".full-calendar").evaluate(
      (root) =>
        Array.from(root.querySelectorAll<HTMLElement>("*")).filter((el) => {
          const box = el.getBoundingClientRect(),
            c = getComputedStyle(el)
              .backgroundColor.match(/[\d.]+/g)
              ?.map(Number);
          return (
            box.width > 100 &&
            box.height > 40 &&
            c &&
            c.length >= 3 &&
            (c.length < 4 || c[3] > 0.8) &&
            Math.min(...c.slice(0, 3)) > 170
          );
        }).length,
    );
    expect(
      bright,
      `${view} should not have white weekend, all-day, or non-working surfaces`,
    ).toBe(0);
    for (const color of ["green", "orange", "purple"]) {
      const card = page.locator(`.full-calendar .event-${color}`).first();
      if (await card.count())
        expect(
          await contrast(page, `.full-calendar .event-${color}`),
        ).toBeGreaterThan(4.5);
    }
  }
  await page.goto("/accounts");
  await page
    .getByRole("button", { name: "Side project account actions" })
    .click();
  await page.getByRole("menuitem", { name: "Edit label & color" }).click();
  await page.getByRole("button", { name: "blue account color" }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.goto("/?date=2026-10-27&view=week");
  await expect(
    page.locator(".full-calendar .event-blue").first(),
  ).toBeVisible();
  expect(await contrast(page, ".full-calendar .event-blue")).toBeGreaterThan(
    4.5,
  );
  expect(errors).toEqual([]);
});
test("drawers, warnings, meeting cards, search, menus and account dialogs use the dark palette", async ({
  page,
}) => {
  await dark(page);
  await page.goto("/?date=2026-10-27");
  await page
    .locator(".calora-event")
    .filter({ hasText: "Dentist appointment" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await contrast(page, ".event-conflict-notice")).toBeGreaterThan(4.5);
  await page.keyboard.press("Escape");
  await page
    .locator(".calora-event")
    .filter({ hasText: "Design standup" })
    .click();
  await expect(page.locator(".meeting-card")).toBeVisible();
  expect(await contrast(page, ".meeting-card .button.primary")).toBeGreaterThan(
    4.5,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Search anything/ }).click();
  await expect(page.locator(".search-dialog")).toBeVisible();
  expect(await contrast(page, ".search-dialog")).toBeGreaterThan(4.5);
  await page.keyboard.press("Escape");
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Work account actions" }).click();
  expect(await contrast(page, ".menu")).toBeGreaterThan(4.5);
  await page.getByRole("menuitem", { name: "Edit label & color" }).click();
  expect(await contrast(page, ".dialog")).toBeGreaterThan(4.5);
});
test("dark appearance is applied before hydration and remains on sign-in", async ({
  page,
}) => {
  await dark(page);
  await page.addInitScript(() => {
    const transitions: string[] = [];
    (window as unknown as { themeTransitions: string[] }).themeTransitions =
      transitions;
    new MutationObserver(() => {
      const theme = document.documentElement?.dataset.theme;
      if (theme) transitions.push(theme);
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  });
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { themeTransitions: string[] }).themeTransitions,
    ),
  ).not.toContain("light");
  await page.goto("/sign-in");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await contrast(page, ".sign-in-card")).toBeGreaterThan(4.5);
});
test("mobile dark navigation and sheets keep contrast and correct surfaces", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await dark(page);
  await page.goto("/?date=2026-10-27");
  await expect(page.locator(".agenda-event").first()).toBeVisible();
  expect(await contrast(page, ".mobile-nav")).toBeGreaterThan(4.5);
  await page
    .getByRole("button", { name: "Choose calendars", exact: true })
    .click();
  expect(await contrast(page, ".filter-dialog")).toBeGreaterThan(4.5);
  await page.keyboard.press("Escape");
  await page
    .locator(".agenda-event-open")
    .filter({ hasText: "Design standup" })
    .first()
    .click();
  expect(await contrast(page, ".event-drawer")).toBeGreaterThan(4.5);
});
