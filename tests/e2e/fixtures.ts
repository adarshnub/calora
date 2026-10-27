import { test as base, expect } from "@playwright/test";
import { DEMO_CONNECTIONS, fixtureEvents } from "../fixtures/calendar";
import type { Connection, SavedView } from "../../src/lib/shared/types";
import { eventInRange } from "../../src/lib/shared/dates";
// Test-only network responses. These records are never bundled with the app,
// written to its database, or available through a runtime demo switch.
export const test = base.extend({
  page: async ({ page }, use) => {
    let connections: Connection[] = structuredClone(DEMO_CONNECTIONS).map(
      (c) => ({ ...c, status: "connected" }),
    );
    let views: SavedView[] = [];
    await page.route("**/api/connections", async (route) =>
      route.fulfill({ json: connections }),
    );
    await page.route("**/api/connections/*", async (route) => {
      const id = new URL(route.request().url()).pathname.split("/").pop();
      if (route.request().method() === "PATCH") {
        const patch = route.request().postDataJSON();
        connections = connections.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        );
      }
      if (route.request().method() === "DELETE")
        connections = connections.filter((c) => c.id !== id);
      await route.fulfill({ json: { ok: true, revoked: true } });
    });
    await page.route("**/api/preferences", async (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        if (body.selected)
          connections = connections.map((c) => ({
            ...c,
            sources: c.sources.map((s) => ({
              ...s,
              selected: body.selected.includes(s.id),
            })),
          }));
      }
      await route.fulfill({ json: { ok: true } });
    });
    await page.route("**/api/saved-views", async (route) => {
      if (route.request().method() === "POST") {
        const view = route.request().postDataJSON();
        views.push(view);
        await route.fulfill({ json: view });
      } else await route.fulfill({ json: views });
    });
    await page.route("**/api/saved-views/*", async (route) => {
      const id = new URL(route.request().url()).pathname.split("/").pop();
      views = views.filter((v) => v.id !== id);
      await route.fulfill({ json: { ok: true } });
    });
    await page.route("**/api/events?*", async (route) => {
      const p = new URL(route.request().url()).searchParams,
        start = p.get("start")!,
        end = p.get("end")!,
        zone = p.get("timeZone") ?? "Asia/Kolkata";
      const events = fixtureEvents(start, end).filter((e) =>
        eventInRange(e, start, end, zone),
      );
      await route.fulfill({
        json: {
          events,
          coverageComplete: true,
          sourceStatus: connections.flatMap((c) =>
            c.sources.map((s) => ({
              sourceId: s.id,
              state: "fresh",
              fetchedAt: new Date().toISOString(),
              coverage: true,
            })),
          ),
        },
      });
    });
    await use(page);
  },
});
export { expect };
