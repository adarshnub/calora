# Acceptance results

Verified on Windows with Node 24.18.0, Chrome through Playwright, and PostgreSQL 17 in Docker. The in-app browser was unavailable; browser checks used installed Chrome. Desktop, settings, connection dialogs, and phone screenshots were inspected directly.

| Check | Result |
| --- | --- |
| TypeScript and production build | Passed |
| Domain and provider tests | 37 passed |
| PostgreSQL integration tests | 5 passed |
| Browser journeys and regressions | 29 passed |
| Desktop and phone console | No application errors |
| Screen widths | 320, 390, 768, 1024, 1280, 1536 px passed |
| Production without configuration | Redirects to sign-in; private data APIs return CONFIGURATION_REQUIRED |
| Removed preview flag | Cannot enable sample content or bypass production authentication |
| Local database after test cleanup | 0 owners, 0 connections, 0 events |

Dark-theme checks cover Week, Day, Three days, Month, agenda, event drawers, meeting cards, overlap warnings, account dialogs, dropdown menus, search, mobile navigation, and filter sheets. Weekends, all-day areas, non-working hours, borders, and controls share a semantic palette. All four event colors and tested text/control pairs exceed 4.5:1 contrast. Reload and sign-in preserve dark appearance; observing reload found no intermediate light theme. System appearance follows operating-system changes.

The actual application starts empty. Tests inject the old sample-storage payload and confirm that its accounts, events, selections, and saved mixes never reappear. Only appearance is migrated; the legacy entry is removed. Unconfigured development APIs return no invented records and incomplete coverage. Production requires full configuration and owner sign-in.

Calendar interaction tests supply isolated Playwright network responses. Synthetic records exist only under tests; the application never imports them, its APIs never serve them, and no runtime fixture switch exists. Journeys cover filtering, comparison, details and browser Back, saved mixes, bounded search, account labels/colors, preferences, mobile filter drafts, and independent desktop/phone views.

Domain tests cover identity grouping, source privacy, recurrence, typed dates, DST, overlaps, encryption, OAuth binding/replay rejection, pagination, and provider failures. PostgreSQL checks exercise complete replacement, stable references, later-page failure, source restriction, disconnect races, and durable jobs using mocked provider responses.

Live Google authorization requires the owner's OAuth credentials. Real Google expiry, Workspace policy, revocation, Firefox, physical Android/iOS devices, assistive technology, large text, mobile keyboard layouts, and constrained-network performance remain external checks. No public deployment has been made.
