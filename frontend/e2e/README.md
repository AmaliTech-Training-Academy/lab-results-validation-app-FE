# End-to-end tests

Eight journeys through the real application in a real browser: Chrome → the Vite dev server → the
backend → Postgres. No SharePoint tenant is involved. The backend runs with its drive served from a
folder on disk, so a journey can create the exact spreadsheet situation it needs.

## Running them

Three things have to be up. The first two are containers this suite owns outright; the third is the
backend, started by hand so a half-migrated database is never mistaken for a test failure.

```bash
# 1. Throwaway database and cache (once per machine; they persist between runs)
docker run -d --name validata-e2e-db \
  -e POSTGRES_USER=e2e -e POSTGRES_PASSWORD=e2e -e POSTGRES_DB=validata_e2e \
  -p 55432:5432 postgres:16-alpine
docker run -d --name validata-e2e-redis -p 56379:6379 redis:7-alpine

# 2. The backend, serving its drive from this folder instead of SharePoint
cd ../../lab-results-validation-app-BE/labresultsvalidator
DB_HOST=localhost DB_PORT=55432 DB_NAME=validata_e2e DB_USER=e2e DB_PASSWORD=e2e \
REDIS_HOST=localhost REDIS_PORT=56379 \
AZURE_TENANT_ID=unused AZURE_CLIENT_ID=unused AZURE_CLIENT_SECRET=unused \
SHAREPOINT_SITE_ID=fixture-site \
JWT_SECRET=dmFsaWRhdGEtZTJlLW9ubHktaHMyNTYtc2lnbmluZy1rZXktNDhieXRlcy1sb25nISE= \
MAIL_HOST=localhost MAIL_PORT=1025 MAIL_USERNAME=validata@example.test MAIL_PASSWORD=unused \
SHAREPOINT_SOURCE=fixtures \
SHAREPOINT_FIXTURE_ROOT=<absolute path to>/frontend/e2e/.drive \
  ./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="-Dserver.port=8081"

# 3. The tests. Playwright starts the frontend itself.
cd frontend && npx playwright test
```

Nothing here touches a developer's own stack: the database, cache and backend all run on their own
ports, so an app already running on 8080 against the normal database is left alone.

## Three things that will waste your time if you do not know them

**The dev server must run on port 5173.** The backend's CORS allow-list is
`http://localhost:3000,http://localhost:5173`, and the browser sends the dev server's port as its
`Origin` — the Vite proxy does not disguise it. On any other port every API call comes back
`403 Invalid CORS request`, which looks exactly like a broken login and is not one. Use another port
only if you also add it to `CORS_ALLOWED_ORIGINS` on the backend.

**Sign-in emails must be on a real corporate domain.** The login form enforces an allow-list —
`@amalitech.com`, `@amalitechtraining.com`, `@amalitechtraining.org` — and refuses anything else
before a request is sent. The backend has no such rule, so an admin seeded on a test domain will
authenticate perfectly over the API and still be unable to reach the sign-in screen. `seedAdmin()`
already uses an allowed domain.

**A real SMTP sink must be running, or the suite lies to you.** Every stand-up or sync failure emails
*every active admin*. With nothing listening on the mail port each send blocks until the connection
fails, and with a suite's worth of accumulated admins that saturates the notification thread pool and
stops progress events reaching the screen — which looks exactly like a broken progress display. It
cost a wrongly-raised finding. Start one:

```bash
docker run -d --name validata-e2e-mail -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

`seedAdmin()` also retires the previous run's admins for the same reason, so the fan-out stays at one.

**The browser needs no download.** The suite drives the Chrome already installed on the machine
(`channel: 'chrome'`), so there is no 150MB Playwright browser fetch.

## How a journey gets its data

`seed.ts` writes rows straight into the throwaway database and files into the drive folder. Two
rules worth keeping:

- **Nothing shares an identity between journeys.** `instructor_contacts` is global with a unique
  email *and* a unique name; reusing either fails on the second insert. Every helper adds a suffix.
- **Nothing is deleted between journeys.** A cohort that has had a run cannot be deleted at all —
  the audit tables are append-only and hold it in place. Isolation comes from uniqueness instead,
  and the drive folder is cleared once at the start of the run.

## What these do and do not cover

They cover what a person clicking through the application would check: that the screens show what
happened, and that the failures are legible. They deliberately do **not** re-test the ingestion
rules, the validation rules or the audit writes — 387 backend tests already do that, faster and
with better failure messages. If a journey here fails, look at the screen; if a rule is wrong, the
backend suite will say so first.
