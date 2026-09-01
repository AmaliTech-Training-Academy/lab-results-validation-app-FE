import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end configuration.
 *
 * Two deliberate choices:
 *
 * - **The system Chrome is used** (`channel: 'chrome'`) rather than Playwright's own browser
 *   download. It keeps the install light and means the suite runs on a machine that already has
 *   Chrome, which every developer here does.
 * - **Playwright starts the frontend, not the backend.** The backend needs a database and a fixture
 *   drive, so it is a documented prerequisite (see `e2e/README.md`) rather than something started
 *   and torn down per run — a half-migrated database is a far worse failure mode than a clear
 *   "backend not reachable".
 */
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:8081'
// 5173 on purpose: the backend's default CORS allow-list is
// http://localhost:3000,http://localhost:5173, and the browser's Origin header is the dev
// server's port — the Vite proxy does not disguise it. Any other port answers every API call
// with 403 "Invalid CORS request", which looks like a login bug and is not one. Override with
// E2E_PORT only if you also add that port to CORS_ALLOWED_ORIGINS on the backend.
const PORT = Number(process.env.E2E_PORT ?? 5173)

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // One worker: the journeys share one backend and one database, so running them in parallel would
  // make them race for the same cohorts. Correctness first; the suite is small enough to be quick.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_API_TARGET: API_TARGET },
  },
})
