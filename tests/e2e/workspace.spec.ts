import { test, expect } from "./fixtures";
test("desktop and mobile keep separate time views", async ({ page }) => {
  await page.goto("/?date=2026-10-27");
  await page.locator(".view-button").click();
  await page.getByRole("menuitem", { name: /^Month/ }).click();
  await expect(page.locator(".calendar-month")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".agenda-list")).toBeVisible();
  await page.locator(".view-button").click();
  await page.getByRole("menuitem", { name: /^Day/ }).click();
  await expect(page.locator(".calendar-day")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(page.locator(".calendar-month")).toBeVisible();
  await page.reload();
  await expect(page.locator(".calendar-month")).toBeVisible();
});
test("mobile month shows readable events below selected dates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?date=2026-10-27");
  await page.locator(".view-button").click();
  await page.getByRole("menuitem", { name: /^Month/ }).click();
  await expect(page.locator(".mobile-month-grid")).toBeVisible();
  await page
    .locator(".mobile-month-grid")
    .getByRole("button", { name: /Wednesday, October 28, 2026/ })
    .click();
  await expect(
    page.locator(".agenda-event").filter({ hasText: "Coffee & catch-up" }),
  ).toBeVisible();
});
test("account mode isolates the selected account and connection explains setup", async ({
  page,
}) => {
  await page.goto("/?date=2026-10-27");
  await page.getByRole("button", { name: "By account", exact: true }).click();
  await expect(
    page.locator(".calora-event").filter({ hasText: "Lunch with Maya" }),
  ).toHaveCount(0);
  await page.locator(".account-tab").filter({ hasText: "Personal" }).click();
  await expect(
    page.locator(".calora-event").filter({ hasText: "Lunch with Maya" }),
  ).toBeVisible();
  await expect(
    page.locator(".calora-event").filter({ hasText: "Weekly planning" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Connect account", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Complete your private workspace setup",
  );
  await expect(
    page.getByRole("button", { name: /View workspace setup/ }),
  ).toBeVisible();
});
test("desktop schedule, event details, browser Back, and source filters", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?date=2026-10-27");
  await expect(page).toHaveTitle("Calora — Your time, together");
  await expect(
    page.getByRole("heading", { name: "Your time, together." }),
  ).toBeVisible();
  await page
    .locator(".calora-event")
    .filter({ hasText: "Weekly planning" })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Weekly planning", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Join meeting" }),
  ).toHaveAttribute("href", "https://meet.google.com/");
  await page.goBack();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("checkbox", { name: "Select Work account", exact: true })
    .uncheck();
  await expect(
    page.locator(".calora-event").filter({ hasText: "Weekly planning" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Select Work account", exact: true }),
  ).not.toBeChecked();
  expect(errors).toEqual([]);
});
test("all-hidden state and saved calendar mix", async ({ page }) => {
  await page.goto("/?date=2026-10-27");
  const all = page.getByRole("checkbox", {
    name: "Select all calendars",
    exact: true,
  });
  await all.check();
  await all.uncheck();
  await expect(page.getByText("A little too quiet?")).toBeVisible();
  await all.check();
  await page.getByRole("button", { name: "Save current selection" }).click();
  await page.getByLabel("View name").fill("My focus");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "My focus", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "My focus", exact: true }),
  ).toBeVisible();
});
test("all calendar time views and two-account comparison render", async ({
  page,
}) => {
  await page.goto("/?date=2026-10-27");
  await expect(page.locator(".calora-event").first()).toBeVisible();
  for (const name of ["Month", "Day", "3 days", "Agenda", "Week"]) {
    await page.locator(".view-button").click();
    await page.getByRole("menuitem", { name: new RegExp(`^${name}`) }).click();
    await expect(
      page
        .locator(name === "Agenda" ? ".agenda-event" : ".calora-event")
        .first(),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator(".compare-grid")).toHaveCount(2);
  await expect(page.getByLabel("First comparison account")).toBeVisible();
});
test("search states its range and opens a matching event", async ({ page }) => {
  await page.goto("/?date=2026-10-27");
  await page.getByRole("button", { name: /Search anything/ }).click();
  await page
    .getByRole("textbox", { name: "Search calendar events" })
    .fill("Lunch with Maya");
  await expect(page.locator(".search-results button").first()).toContainText(
    "Lunch with Maya",
  );
  await page.locator(".search-results button").first().click();
  await expect(
    page.getByRole("heading", { name: "Lunch with Maya", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/event=/);
});
test("account labels and colors persist", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Work account actions" }).click();
  await page.getByRole("menuitem", { name: "Edit label & color" }).click();
  await page.getByLabel("Account label").fill("Studio");
  await page.getByRole("button", { name: "blue account color" }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".connection-heading").first()).toContainText(
    "Studio",
  );
  await page.reload();
  await expect(page.locator(".connection-heading").first()).toContainText(
    "Studio",
  );
});
test("preferences persist and dark mode is applied", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Clock format").selectOption("24");
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("America/New_York");
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByLabel("Clock format")).toHaveValue("24");
  await expect(page.getByLabel("Time zone", { exact: true })).toHaveValue(
    "America/New_York",
  );
});
test("mobile agenda, filter draft cancel and apply, and detail sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?date=2026-10-27");
  await expect(page.locator(".agenda-event").first()).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose calendars", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("checkbox", { name: "Select Work account", exact: true })
    .uncheck();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose calendars", exact: true })
    .click();
  await expect(
    dialog.getByRole("checkbox", { name: "Select Work account", exact: true }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: /Apply/ }).click();
  await page
    .locator(".agenda-event-open")
    .filter({ hasText: "Design standup" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Design standup", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close event details" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
for (const width of [320, 390, 768, 1024, 1280, 1536])
  test(`no shell overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/?date=2026-10-27");
    await expect(page.locator(".page-heading h1")).toBeVisible();
    await expect(
      page.locator(width < 768 ? ".agenda-event" : ".calora-event").first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("API validates ranges, disables credential-less linking, and marks responses private", async ({
  request,
}) => {
  const result = await request.get(
    "/api/events?start=2026-10-27&end=2026-11-02",
  );
  expect(result.status()).toBe(200);
  expect(result.headers()["cache-control"]).toBe("private, no-store");
  expect((await result.json()).events).toEqual([]);
  expect(
    (await request.get("/api/events?start=2026-01-01&end=2027-01-01")).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/integrations/google/start", { data: {} })
    ).status(),
  ).toBe(503);
});
