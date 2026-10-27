# Calora

Your time, together. A private, read-only Google Calendar workspace built from the supplied multi-account calendar implementation plan.

Calora includes a responsive weekly calendar, mobile agenda, Day / Three days / Month views, account-specific schedules, two-account comparison, range-limited search, event detail sheets, conference links, overlap detection, saved calendar selections, account customization, and light / dark / system preferences.

## Try it locally

Requires Node.js 24.11 or newer on the Node 24 line. This project was built and checked with Node 24.18.0.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. An unconfigured development checkout opens an empty setup workspace. No accounts, calendars, meetings, or profile identity are invented. Connect your Google accounts after completing the server configuration.

The empty setup workspace lets you configure appearance and date preferences locally. Private calendar data is never saved in browser storage. Existing sample accounts, events, and saved mixes are discarded on reload; only the appearance choice is migrated. The application does not create or modify Google events.

## Enable your real calendars

1. Copy `.env.example` to `.env`. Keep `.env` out of source control.
2. Create a hosted Supabase project. In **Connect**, copy the Transaction pooler URL (port `6543`) to `DATABASE_URL` and the Session pooler URL (port `5432`) to `DIRECT_DATABASE_URL`. Both must use the same database. Include `sslmode=require` and use your database password, with special characters percent-encoded. Disable Supabase's Data API for this project: Calora uses server-side Prisma queries and Better Auth. Local Docker and Supabase API keys are not required. See the [deployment guide](docs/vercel-deployment.md) for the complete setup.
3. Generate **two different** secrets by running this command twice:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   Use one for `BETTER_AUTH_SECRET` and the other for `TOKEN_ENCRYPTION_KEY`. Set `TOKEN_KEY_VERSION=1`.

4. Set `OWNER_EMAIL` to the verified Google email allowed to sign in. Keep this fixed for your private owner. You can additionally pin `OWNER_GOOGLE_SUB` to that owner's Google subject after the first login. Connecting other calendar accounts does not grant them login access.
5. Create a Google Cloud project, enable the Google Calendar API, configure its OAuth consent audience, and create a **Web application** OAuth client. For accounts across unrelated organizations, configure an External audience. Add the intended accounts as test users while developing.
6. Register these exact development redirect URIs:

   ```text
   http://localhost:3000/api/auth/callback/google
   http://localhost:3000/api/integrations/google/callback
   ```

   Register corresponding HTTPS URIs for production. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `BETTER_AUTH_URL` to the matching client and application origin, without a trailing slash.

7. Apply the migration and start the application:

   ```sh
   npm run db:migrate
   npm run dev
   ```

8. In a **second terminal**, run the persistent worker:

   ```sh
   npm run worker
   ```

9. Sign in as the configured owner, connect an account, and select its calendars. New connections initially select the primary calendar. Repeat to attach additional Google identities to the same workspace.

The login asks for identity scopes. Calendar connections separately request `openid`, `email`, `calendar.calendarlist.readonly`, and `calendar.events.readonly`. No write scopes are requested. Availability-only calendars are labelled as restricted; free/busy access is not included in this release.

Google OAuth apps in Testing can have short-lived Calendar refresh tokens. Set the appropriate publishing status for ongoing personal use and review Google's current consent requirements. Workspace administrators may independently restrict access. If remote grant revocation fails on disconnect, Calora reports that local removal completed and directs you to Google permissions. Google revocation can affect other OAuth clients in the same Cloud project.

## Run in production

For Vercel, follow the [Vercel deployment guide](docs/vercel-deployment.md) and use [.env.production.example](.env.production.example). The repository includes the Next.js build configuration and a Vercel Daemon for the sync worker; Daemons are currently in public beta.

Calora requires **three runtime pieces**: PostgreSQL, a Next.js Node server, and a persistent Node worker. It cannot run as a static export.

```sh
npm ci
npm run db:migrate
npm run build
npm run start
```

Run `npm run worker` as a separate supervised service with the same server environment. Run the migration once before starting new application instances. Configure both processes to restart on failure. Redact OAuth callback query strings in your reverse-proxy and hosting access logs. Expose the web server through HTTPS, register the exact HTTPS OAuth callbacks, and set `BETTER_AUTH_URL` accordingly. The worker must remain running even when no browser is open. Use Vercel Daemons or another persistent process host for the worker when the frontend is serverless.

Production fails closed when configuration is missing and requires owner sign-in. The former demo flag has been removed; sample data cannot be enabled through an environment variable.

Keep database backups and encryption keys separately protected. Changing the token key without a migration makes existing credentials unreadable and requires reconnection. The credential envelope records a key version. Private API responses use `private, no-store`; event content is not cached by a service worker or in localStorage. The application uses secure cookies on HTTPS, origin checks, owner-scoped data access, and security response headers. The included mutation limiter is per process; multi-instance hosts should also rate-limit at their gateway.

## Verification

```sh
npm run typecheck
npm test
npm run test:e2e
npm run test:db
npm run build
```

`test:e2e` uses installed Chrome through Playwright and starts an unconfigured development server if necessary. It checks the real empty state and supplies isolated network fixtures for calendar interaction and color-contrast checks. Test fixtures live only under `tests/`; they are never imported by the application, served by its API, or stored in the application database. Install Chrome or adjust the Playwright channel if your host uses a different browser.

`test:db` requires `DATABASE_URL` pointing to a **migrated test database**. It creates uniquely named fictional owners, removes only those test owners afterward, and checks atomic publication, stable event references, later-page failure, permission loss, disconnection races, and durable PostgreSQL jobs. It also runs the domain tests. Run it against a disposable development database rather than production.

See [acceptance results](docs/acceptance.md) for what was exercised and the remaining live-account gates. Screenshots and browser traces are temporary QA artifacts and are not part of the source deliverable.

## Data and calendar behavior

- Timed events use UTC instants. All-day events retain date-only starts and exclusive ends. Google expands recurrence within bounded windows; there is no local recurrence engine.
- Each selected source is fetched with complete pagination, including empty intermediate pages. A new immutable snapshot becomes active only after every page succeeds. Publication checks connection credentials and source access again under database locks.
- A successful replacement removes canceled events and occurrences moved out of range. Event detail references survive snapshot replacement. Superseded data is cleaned up by the daily worker job.
- Filtering happens before duplicate grouping. Invitation identity uses `iCalUID` and normalized original recurrence start; shared-calendar identity falls back to Google calendar and event IDs. Matching names and times alone never establish identity. Materially different copies remain separate variants.
- Overlaps use half-open intervals. Adjacent events do not conflict; canceled, declined, and explicitly free observations do not block availability. An accepted copy remains busy when another account declines. All-day busy behavior is a preference. Tentative and unanswered responses remain available in details.
- Missing, restricted, reconnecting, and stale sources produce explicit coverage notices. An empty array never proves availability when coverage is incomplete.
- The application refreshes active ranges toward a two-minute freshness target, pauses background polling when hidden, and supports manual refresh. Durable jobs deduplicate requests, back off retryable failures, and respect provider rate-limit delays. Discovery runs on connect, reconnect, manual refresh, and daily maintenance.
- Calendar filters and user preferences are stored in PostgreSQL in live mode. Mobile and desktop remember their time views separately. Search is explicitly limited to a selected window of at most 62 days.

## Project map

```text
src/app/                 Server-rendered routes and API entry points
src/components/          Workspace shell and accessible UI primitives
src/features/calendar/  Views, agenda, search, details, and data queries
src/features/accounts/  Connection management
src/features/settings/  Workspace preferences
src/lib/shared/          Typed dates, schemas, grouping, and overlap logic
src/lib/server/          Owner auth, OAuth, encryption, provider, jobs, snapshots
workers/                Persistent pg-boss worker
prisma/                 Schema and reproducible SQL migration
tests/                  Domain, browser, and PostgreSQL integration tests
```

Resolved versions are recorded in `package-lock.json`: Next.js 16.4.3, React 19.3.1, FullCalendar 7.1.3, Prisma 7.10.1, Better Auth 1.7.13, pg-boss 12.38.0, Tailwind 4.3.3, TanStack Query 5.105.0, temporal-polyfill 1.0.6, and TypeScript 5.9.3. Prisma 7 was selected instead of the Prisma 8 release candidate. FullCalendar uses the v7 React plugins and theme APIs consistently.

## Follow-on scope

Google watch notifications, incremental sync tokens, contextual free/busy permission, installable offline calendars, event creation, editing, RSVP changes, and drag-to-reschedule are intentionally separate from this read-only release. No premium FullCalendar resource plugin is required.

## Appearance

Light, dark, and system appearance use shared semantic colors in `src/app/theme.css`. Calendar grids, weekends, non-working hours, popovers, account colors, warnings, forms, menus, and mobile sheets all use those colors. Appearance is applied before the body paints, persists across reloads, and follows operating-system changes when System is selected.
