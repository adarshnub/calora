import { test, expect } from "./fixtures";
import { DEMO_CONNECTIONS } from "../fixtures/calendar";
import type { Connection } from "../../src/lib/shared/types";

for (const width of [1440, 390]) {
  test(`disabled Calendar API explains the fix and retries discovery at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let connections: Connection[] = [
      {
        ...structuredClone(DEMO_CONNECTIONS[0]),
        status: "connected",
        lastError: "CALENDAR_API_DISABLED",
        sources: [],
      },
    ];
    await page.route("**/api/connections", (route) =>
      route.fulfill({ json: connections }),
    );
    let syncBody: { start: string; end: string; timeZone: string } | undefined;
    await page.route("**/api/sync", async (route) => {
      syncBody = route.request().postDataJSON();
      connections = [
        {
          ...structuredClone(DEMO_CONNECTIONS[0]),
          status: "connected",
          lastError: null,
        },
      ];
      await route.fulfill({ status: 202, json: { queued: true } });
    });

    await page.goto("/accounts");
    await expect(page).toHaveTitle("Accounts · Calora");
    await expect(
      page.getByRole("heading", { name: "Good company for your calendars." }),
    ).toBeVisible();
    await expect(page.locator(".connection-status")).toHaveText(
      "Calendar API disabled",
    );
    await expect(page.locator(".account-error")).toContainText(
      "Google Calendar API is disabled for this app.",
    );
    await expect(
      page.getByRole("link", { name: "Google Cloud", exact: true }),
    ).toHaveAttribute(
      "href",
      "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Retry discovery", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Calendar discovery queued",
    );
    expect(syncBody?.timeZone).toBe("Asia/Kolkata");
    expect(syncBody?.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.reload();
    await expect(page.locator(".connection-status")).toHaveText("Connected");
    await expect(page.locator(".calendar-source-row").first()).toBeVisible();
    await expect(page.locator(".account-error")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Refresh calendars", exact: true }),
    ).toBeEnabled();
    expect(errors).toEqual([]);
  });
}
