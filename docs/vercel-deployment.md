# Deploy Calora to Vercel

Calora has three runtime pieces: the Next.js application, the calendar-sync worker, and PostgreSQL. This repository now includes a Vercel configuration for the application and one worker instance using [Vercel Daemons](https://vercel.com/docs/daemons), currently in public beta. A normal Next.js deployment alone does not start the calendar worker.

The prepared files are `vercel.json`, `Dockerfile.worker`, `.dockerignore`, `.env.production.example`, and `scripts/vercel-build.mjs`. No Vercel project, hosted database, Google OAuth client, or production secrets have been created for you. You do not need Docker installed locally: Vercel builds the worker container in the cloud.

## 1 Choose your production URL

Use a stable address such as `https://YOUR_PROJECT.vercel.app` or a custom domain. Use the same origin in `BETTER_AUTH_URL` and Google OAuth settings, with no trailing slash. A per-commit preview URL is not your production origin.

Create/import the Git repository in Vercel to reserve your project name. Select the Next.js framework and repository root. Configure the database and environment before the first production deployment.

## 2 Create Supabase PostgreSQL

Create a Supabase project for Calora, then open **Connect**. Copy two PostgreSQL connection strings for the **same database**:

- `DATABASE_URL`: **Transaction pooler**, port `6543`, for Prisma application queries.
- `DIRECT_DATABASE_URL`: **Session pooler**, port `5432`, for migrations and pg-boss. Despite the variable name, a session pooler is supported. A reachable direct connection also works.

Copy the exact host and username from the Connect dialog; do not guess the pooler host from the region. Replace the password placeholder with your **database password**, percent-encoding special characters, and include `sslmode=require`. Supabase's shared poolers support IPv4. Its direct connection normally requires IPv6 or the IPv4 add-on, so the session pooler avoids that connectivity problem. Do not use a transaction-pooler URL for `DIRECT_DATABASE_URL`: migrations need session continuity. See [Supabase's connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

If an existing Vercel configuration still has a Supabase direct URL in `DIRECT_DATABASE_URL`, Calora routes migrations and the job queue through the shared pooler host already configured in `DATABASE_URL`, using session mode on port `5432`. It preserves the migration role and password and checks that both URLs refer to the same project and database. Other providers and direct connections outside Vercel are unchanged. The preferred explicit configuration is still the two pooler URLs above.

The Node PostgreSQL connections use the public Supabase Root 2021 CA bundled in `src/lib/server/supabase-ca.ts`, sourced from Supabase's official dashboard download URL. This verifies the server certificate and hostname without disabling TLS checks. An explicitly configured `sslrootcert` is preserved. See [Supabase SSL configuration](https://supabase.com/docs/guides/platform/ssl-enforcement).

For this dedicated Calora project, **disable the Supabase Data API** in the dashboard. Calora accesses PostgreSQL through server-side Prisma and handles Google sign-in with Better Auth; it does not use Supabase Auth or browser database access. Supabase explicitly recommends disabling the Data API for Prisma-only applications. See [Supabase's Prisma guide](https://supabase.com/docs/guides/database/prisma) and [Data API settings](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api).

Use a database role that can apply the Prisma migrations and create the `pgboss` schema. A new project's database owner connection can perform the initial setup. No Supabase URL, anon/publishable key, or service-role/secret API key is needed. A `prisma+postgres://` URL is also unsuitable: this app uses the PostgreSQL `pg` driver.

The checked-in configuration runs the app and worker in `iad1`, Northern Virginia. Choose a nearby database region, or change **both** `regions` and the daemon's `instances` region in `vercel.json` to match your database. Keep one worker instance initially.

## 3 Configure Google OAuth

In Google Cloud / Google Auth Platform:

1. Create or select a project and enable the **Google Calendar API**.
2. Configure the consent screen and audience. Use an External audience when combining personal Gmail and unrelated Workspace accounts.
3. During development, add your owner email and the accounts you will connect as test users.
4. Create an OAuth client of type **Web application**. Copy its client ID and client secret into Vercel.
5. Register these two authorized redirect URIs, replacing the domain:

   ```text
   https://YOUR_PROJECT.vercel.app/api/auth/callback/google
   https://YOUR_PROJECT.vercel.app/api/integrations/google/callback
   ```

6. If configuring Authorized JavaScript origins, use `https://YOUR_PROJECT.vercel.app` without a path. This app's OAuth exchange happens on the server.

The first callback signs in the owner. The second attaches another calendar identity to that owner. The owner login requests identity scopes. Calendar connections request `openid`, `email`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly`, and `https://www.googleapis.com/auth/calendar.events.readonly`.

Google requires an exact redirect match, including scheme and path. External apps left in Testing generally receive seven-day refresh tokens when requesting Calendar scopes. Publishing status, verification, and Workspace administrator policy are separate matters; review the [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2) for ongoing use.

## 4 Set Vercel Production environment variables

Open **Project Settings → Environment Variables**. Add the following for the **Production** environment. `.env.production.example` is a template; editing it does not configure Vercel.

| Name                   | Value                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`         | Supabase Transaction pooler URL, port 6543, TLS required                    |
| `DIRECT_DATABASE_URL`  | Supabase Session pooler URL, port 5432, for the same database                |
| `BETTER_AUTH_URL`      | Stable HTTPS production origin, no trailing slash                         |
| `BETTER_AUTH_SECRET`   | A random secret of at least 32 characters                                 |
| `OWNER_EMAIL`          | The verified Google email permitted to sign in                            |
| `GOOGLE_CLIENT_ID`     | Your Google Web application OAuth client ID                               |
| `GOOGLE_CLIENT_SECRET` | That client's secret                                                      |
| `TOKEN_ENCRYPTION_KEY` | An independent random 32-byte key encoded as base64                       |
| `TOKEN_KEY_VERSION`    | `1`                                                                       |
| `OWNER_GOOGLE_SUB`     | Optional; leave unset initially                                           |

Generate two independent random secrets by running this command **twice**:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Use one output for `BETTER_AUTH_SECRET` and the other for `TOKEN_ENCRYPTION_KEY`. Enter actual values in Vercel without surrounding quotes. Keep them stable across deployments; changing the encryption key makes existing calendar credentials unreadable without a migration. The worker automatically receives the deployment's environment, so it uses the same keys and database.

None of these names should start with `NEXT_PUBLIC_`. Do not commit actual `.env` files or generated secrets. You do not need a Supabase service-role key, Redis URL, public Google API key, or the removed demo flag. Vercel sets `NODE_ENV` and `VERCEL_ENV` itself.

## 5 Deploy

Commit and push the application, lockfile, migrations, and new deployment files to your Git repository. Connect it to the Vercel project and deploy the production branch.

| Setting          | Prepared value                         |
| ---------------- | -------------------------------------- |
| Framework        | Next.js                                |
| Root directory   | Repository root                        |
| Node.js          | 24.x, pinned in package.json           |
| Install command  | `npm ci --include=dev`                 |
| Build command    | `npm run build:vercel`                 |
| Output directory | Leave the Next.js default              |
| Worker           | `calendar-worker` daemon, one instance |

`vercel.json` supplies the commands and daemon definition. The build generates Prisma Client, applies committed migrations **only when `VERCEL_ENV=production`**, and builds Next.js. The daemon image generates its own Linux Prisma Client during installation and starts the worker directly with Node so SIGTERM reaches its shutdown handler. Do not add `npm run worker` to the web build command: it is a persistent process, not a build step.

The production migration command is `prisma migrate deploy`, not `prisma migrate dev` or `db push`. A fresh database does not require manual table creation. pg-boss creates its own queue schema on worker startup.

If you change environment variables later, create a new production deployment; existing deployments retain their old values. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## 6 Check the deployment

1. Check the application build logs for successful migrations and compilation.
2. Check the `calendar-worker` daemon logs for **Calora worker ready**. A successful web deployment without a running worker does not verify synchronization.
3. Visit the exact production URL and sign in with `OWNER_EMAIL`.
4. Connect one Google account and allow the read-only scopes. Wait for calendar discovery and select its calendars.
5. Connect another account, open a meeting, and test manual refresh and comparison.
6. Reload and confirm selection, appearance, and account labels persist.

Common configuration symptoms:

| Symptom                                  | Check                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Workspace setup required in production   | All required env values are present in Production, then redeploy                     |
| Google redirect_uri_mismatch             | Exact callback URLs and BETTER_AUTH_URL match the stable domain                      |
| Sign-in forbidden                        | Use the verified OWNER_EMAIL; leave OWNER_GOOGLE_SUB unset until known               |
| Accounts connect but events stay loading | Worker logs, session-pooler URL on port 5432, schema privileges, Calendar scopes      |
| Database cannot be reached               | Hosted hostname, port, credentials, TLS, network policy; never localhost             |
| Tokens cannot decrypt after redeploy     | Restore the same TOKEN_ENCRYPTION_KEY and TOKEN_KEY_VERSION                          |

For Prisma `P1001` errors referencing `db.<project-ref>.supabase.co:5432`, check **Vercel Project Settings > Environment Variables > Production**. Set `DATABASE_URL` to Supabase's Transaction pooler URL (`6543`) and `DIRECT_DATABASE_URL` to its Session pooler URL (`5432`) for the same project, then redeploy. A local `.env.local` edit does not update Vercel. If the pooler also cannot connect, check whether the Supabase project is paused and whether its network restrictions allow the deployment.

## Preview deployments and beta limits

For the first deployment, keep production secrets scoped to Production. Vercel Daemons currently run only in production, so previews do not automatically get a worker. Use a separate database, Google OAuth configuration, stable staging URL, and worker if you later need fully functional staging. Preview builds skip migrations and must never share production credentials accidentally.

Daemons are in public beta and subject to [plan quotas](https://vercel.com/docs/daemons/limits). A stopped or quota-limited worker means queued refreshes will not be processed. If you prefer an external persistent host, run the same Docker image there with the same environment, and remove the `daemons` section from `vercel.json` so only one chosen worker service operates the queue.

## Local development without Docker

Copy `.env.production.example` to the git-ignored `.env.local` and fill in hosted database and development OAuth values. Set `BETTER_AUTH_URL=http://localhost:3000`. Use a separate development Supabase project for local testing. Then run:

```sh
npm ci
npm run db:migrate
npm run dev
```

Run `npm run worker` in a second terminal with the same `.env.local`. Neither process requires local Docker. For a Vercel-only deployment, skip these local commands and set Production variables directly in Vercel.

The production worker's `Dockerfile.worker` remains in the repository because Vercel Daemons build from a Dockerfile. `vercel dev` does not start the worker automatically.

Official references: [Vercel Daemons](https://vercel.com/docs/daemons), [daemon configuration](https://vercel.com/docs/daemons/config-reference), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Prisma 7 on Vercel](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/serverless/deploy-to-vercel), and [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).
