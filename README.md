# Lab Results Validation App — Frontend

**Validata** is the admin web client for AmaliTech's lab-results validation pipeline. It lets
program admins stand up a training cohort's reference data, ingest and validate learner grading
submissions synced from SharePoint, review flagged rows and sync conflicts, and audit past uploads
— all backed by live status over Server-Sent Events rather than manual polling.

A single-page app built with **Vue 3** (`<script setup>`, Composition API), **TypeScript**,
**Vite** and **Pinia**, talking to a separate backend service over a JSON REST API.

## Overview

The app is organized around the lifecycle of a training cohort's grading data:

- **Auth** — email/password login, forced password change on first login, forgot-password reset
  flow. A single admin role today; the auth guard is written to extend to others.
- **Cohort stand-up** (`/admin/cohorts/:id/standup`) — an admin attaches a cohort's SharePoint
  folder link, and the backend runs it through four validation gates (folder link → folder
  structure → reference files → empty score-sheet check). Gates 1–3 stream live over one SSE
  connection, Gate 4 (triggered after the admin accepts the reference data) streams over a second.
  Both are resilient to dropped connections: transient parse errors self-clear on the next good
  event, and a run of consecutive connection failures surfaces a "connection lost" state with a
  manual retry instead of spinning forever.
- **Sync schedules** (`/admin/sync-schedules`) — recurring SharePoint sync jobs per cohort, so
  grading workbooks are pulled in automatically instead of a manual per-run trigger.
- **Grading runs** (`/admin/runs`, `/admin/runs/:id`) — the ingestion history for a cohort: each
  run's file-by-file sync results, row-level conflicts to resolve, and notifications, with the
  in-progress run streaming live the same way stand-up does.
- **Audit log** (`/admin/audit`) — a history of every upload, with a per-upload validation report
  (accepted/rejected row counts, per-row failure reasons) and CSV export.
- **Cohorts, learners, instructors, reference data** — the underlying rosters and reference
  datasets the pipeline validates submissions against.

Two things shape a lot of the code:

- **Everything long-running is a stream, not a poll.** `useEventSourceStream` is the shared
  open/reconnect/give-up plumbing; `useStandupStream`, `useGate4Stream`, and `useSyncRunStream`
  layer their own event shapes on top of it.
- **Mock mode.** The app can run entirely offline against an in-memory fixture dataset instead of
  the real backend — see [Environment Variables](#environment-variables). This is what makes local
  frontend-only development and demos possible without a running backend.

## Getting Started

### Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0` (see `engines` in `frontend/package.json`; CI runs Node 24)
- **npm** (ships with Node)
- A running instance of the backend API if you're working against real data (see
  [Environment Variables](#environment-variables) for how to run against mocks instead)

### Installation

```sh
cd frontend
npm install
```

### Running the App

```sh
npm run dev
```

Starts the Vite dev server (default `http://localhost:5173`). API calls to `/api/*` are proxied
by Vite to `http://localhost:8080` (see `vite.config.ts`) — either point a local backend at that
port, or enable [mock mode](#environment-variables) to run without one.

Other ways to run it:

```sh
# Production build (type-checks, then builds to dist/)
npm run build
npm run preview          # serve the built dist/ locally

# Container build — multi-stage Dockerfile (build stage compiles the SPA,
# runtime stage serves it via nginx and reverse-proxies /api to a backend
# container named `app`; see nginx.conf)
docker build -t validata-frontend .
```

### Running the Tests

```sh
npm run test:unit        # Vitest, watch mode
npm run test:coverage     # single run with lcov coverage (what CI/SonarQube read)
```

## Scripts

All scripts are run from `frontend/`:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check (`vue-tsc --build`) and production-build in parallel, then bundle |
| `npm run preview` | Serve the production build locally |
| `npm run test:unit` | Run the Vitest suite |
| `npm run test:coverage` | Run the suite once with lcov coverage output |
| `npm run lint` | `oxlint --fix` then `eslint --fix --cache` |
| `npm run format` | Prettier, writing in place under `src/` |
| `npm run type-check` | `vue-tsc --build` on its own (also runs as part of `build`) |

## Environment Variables

Copy `frontend/.env.example` to `frontend/.env.local` (gitignored — see `*.local` in
`.gitignore`) to override defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_USE_MOCKS` | unset (`false`) | Set to `true` to run entirely against the in-app mock dataset (`src/services/mock/`) instead of a real backend — no network calls, no backend required. Off by default: the app talks to the real API, proxied at `/api` by Vite in dev (see `vite.config.ts`) or by nginx in the built container (see `nginx.conf`). |

There is no separate "API base URL" variable — the frontend always calls the relative path
`/api/v1/...`; what that resolves to is an environment concern (the Vite dev proxy, or nginx in
the container), not an app-level config value.

## Project Structure

```
frontend/
├── src/
│   ├── views/
│   │   ├── auth/         # Login, forgot-password, forced set-password
│   │   ├── admin/        # Everything under /admin — cohorts, runs, audit, sync schedules, settings…
│   │   ├── instructor/   # Instructor-facing upload/download views (not yet wired into the router)
│   │   └── ForbiddenView.vue
│   ├── components/
│   │   ├── base/         # Design-system primitives: VButton, VModal, VTablePager, VPopover,
│   │   │                 # VRowActions, VEmptyState, VToast, VIcon, …
│   │   └── layout/       # AppShell / AppSidebar / AppTopbar (the admin chrome)
│   ├── composables/       # useEventSourceStream + the per-pipeline streams built on it,
│   │                      # usePageTitle, useQueryParam, usePasswordVisibility, …
│   ├── stores/            # Pinia stores — one per domain (auth, cohorts, runs, standup, …)
│   ├── services/          # fetch-based API clients, one per domain, plus http.ts (shared
│   │                      # auth/caching/error-parsing) and services/mock/ (fixture dataset +
│   │                      # in-memory "engine" the mock streams drive off of)
│   ├── types/              # Domain types shared between services/stores/views
│   ├── utils/              # Small stateless helpers (datetime formatting, pagination, error
│   │                      # message extraction, localStorage-backed UI prefs)
│   ├── router/             # Route table + the single auth navigation guard
│   ├── assets/styles/      # Design tokens (tokens.css) + global.css
│   └── __tests__/          # Vitest specs, mirroring the src/ layout
├── Dockerfile               # 3-stage: builder, runtime-prebuilt (CI, packages an existing dist/),
│                             # runtime (default, builds from source)
├── nginx.conf                # Serves the built SPA + reverse-proxies /api to a backend container
└── vite.config.ts
```

Some `views/admin/*` and all of `views/instructor/*` exist in the codebase but aren't yet reachable
from `src/router/index.ts` — check the router before assuming a view is live in the app.

## Testing & Code Quality

- **Unit/component tests**: Vitest + `@vue/test-utils`, colocated under `src/__tests__/` mirroring
  the source tree.
- **Linting**: `oxlint` (fast, broad ruleset) followed by `eslint` (Vue/TypeScript-specific rules),
  both run with `--fix`.
- **Type checking**: `vue-tsc`, run standalone (`npm run type-check`) or as part of `npm run build`.
- **CI** (`.github/workflows/ci.yml`, on PRs into `develop` and pushes to `main`/`develop`/topic
  branches): build → lint → type-check → test+coverage → production build, then in parallel a
  SonarQube quality-gate scan, a Trivy container scan (fails on CRITICAL/HIGH), and a TruffleHog
  secret scan over the diff.
- **Deploy** (`.github/workflows/deploy-dev.yml`, on push to `develop`): builds the Docker image,
  pushes to ECR, and rolls it out to the dev EC2 instance via SSM.

Before opening a PR, from `frontend/`:

```sh
npm run lint
npm run type-check
npm run test:coverage
npm run build
```

## Contributing

- **Branches**: cut from `develop`, named `<type>/<short-description>` (e.g.
  `feat/run-review-pagination-overhaul`, `fix/conflict-endpoint`, `refactor/http-cache-stream-resilience`,
  `chore/mocks-opt-in`). Open PRs back into `develop`.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) —
  `type(scope): summary`, e.g. `refactor(stores): separate action errors from load errors`,
  `fix(admin): restore the Actions column header on run review tables`. Common types in this repo:
  `feat`, `fix`, `refactor`, `chore`, `test`.
- Keep lint/type-check/tests/build green locally before pushing — the CI pipeline enforces all
  four plus the security scans above, and a failing quality gate blocks merge.
