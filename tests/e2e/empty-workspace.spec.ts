import { test, expect } from "@playwright/test";
test("old sample storage is discarded and real routes return no invented accounts or events", async ({
  page,
  request,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "calora-demo-v1",
      JSON.stringify({
        preferences: { appearance: "dark" },
        connections: [
          {
            id: "legacy",
            label: "Old sample",
            email: "legacy@example.invalid",
          },
        ],
        selected: ["legacy"],
        savedViews: [{ id: "legacy-view", name: "Old sample mix" }],
      }),
    ),
  );
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByText("Every part of your day, in one place."),
  ).toBeVisible();
  await expect(
    page.locator(".calora-event,.agenda-event,.account-filter,.saved-view"),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /Old sample|legacy@example|Demo workspace|fictional week|adarsh@|Lunch with Maya/,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("calora-demo-v1")),
  ).toBeNull();
  const connections = await request.get("/api/connections");
  expect(await connections.json()).toEqual([]);
  const response = await request.get(
    "/api/events?start=2026-10-27&end=2026-11-02",
  );
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(await response.json()).toEqual({
    events: [],
    sourceStatus: [],
    coverageComplete: false,
  });
  await page
    .getByRole("link", { name: "Accounts", exact: true })
    .first()
    .click();
  await expect(page.locator(".connection-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your first connection starts here." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".connection-card")).toHaveCount(0);
});
test("empty workspace preferences and system appearance persist without any sample content", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings");
  await page.getByRole("button", { name: "System", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "System", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Reset demo" })).toHaveCount(0);
  await expect(page.locator("body")).toContainText("Workspace setup required");
});
for (const width of [320, 390, 768, 1024, 1280, 1536])
  test(`empty dark workspace fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() =>
      localStorage.setItem("calora-appearance-v1", "dark"),
    );
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
