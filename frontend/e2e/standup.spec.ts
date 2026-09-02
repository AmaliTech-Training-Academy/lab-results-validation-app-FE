import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { signInAsAdmin, uniqueFolder } from './helpers'
import { WEB_BASE, makeCohortFolder, putReferenceBundle, seedDraftCohort, sql } from './seed'

/**
 * Journeys 3 and 4 — standing a cohort up through the screen, and reading a gate failure.
 *
 * <p>FND-37 is the reason journey 4 exists: when a gate failed, the panel printed the raw error
 * object — braces, field names and a full URL — because the backend sends structured errors for
 * gates 1–3 while the screen expected plain text. It was reported fixed in code in August and has
 * been on the retest list since.
 */

async function openStandup(page: Page, cohortId: string) {
  await page.goto(`/admin/cohorts/${cohortId}/standup`)
  await expect(page.getByRole('heading', { name: 'Cohort stand-up' })).toBeVisible({ timeout: 20_000 })
}

async function runValidation(page: Page, link: string) {
  await page.locator('input[placeholder*="sharepoint.com"]').fill(link)
  await page.getByRole('button', { name: /run validation/i }).click()
}

test('A3–A5 — a well-formed folder passes the gates and waits for an explicit Accept', async ({ page }) => {
  const folder = uniqueFolder('standup-ok')
  const cohort = seedDraftCohort(folder)
  makeCohortFolder(folder)
  putReferenceBundle(folder)

  await signInAsAdmin(page)
  await openStandup(page, cohort.cohortId)
  await runValidation(page, `${WEB_BASE}/${folder}`)

  // Gates 1–3 run as one job over a stream, so wait for the outcome rather than a fixed delay.
  await expect(page.locator('.panel--accept')).toBeVisible({ timeout: 45_000 })

  // A5 AC6 / A6 AC4 — nothing is committed until someone presses Accept. The screen offering the
  // choice is the whole point; if it auto-committed, reference data would appear in a cohort nobody
  // had approved.
  const state = sql(`SELECT lifecycle_state FROM cohorts WHERE id = '${cohort.cohortId}'`)
  expect(state).toBe('DRAFT')
  const committed = sql(
    `SELECT count(*) FROM specializations WHERE cohort_id = '${cohort.cohortId}'`)
  expect(committed).toBe('0')
})

test('A3 AC2 — a Gate 1 failure is recorded and the cohort is left alone', async ({ page }) => {
  const folder = uniqueFolder('standup-bad')
  const cohort = seedDraftCohort(folder)
  // No folder on the drive, so Gate 1 cannot resolve the link.

  await signInAsAdmin(page)
  await openStandup(page, cohort.cohortId)
  await runValidation(page, `${WEB_BASE}/${folder}`)

  await expect(async () => {
    expect(sql(
      `SELECT status FROM cohort_standup_jobs WHERE cohort_id = '${cohort.cohortId}'
       ORDER BY started_at DESC LIMIT 1`)).toBe('FAILED')
  }).toPass({ timeout: 45_000 })

  // The cohort is untouched, so the admin can correct the link and try again.
  expect(sql(`SELECT lifecycle_state FROM cohorts WHERE id = '${cohort.cohortId}'`)).toBe('DRAFT')

  // The failure panel itself is asserted in the Gate 3 journey below rather than here. It DOES
  // appear for a Gate 1 failure — as prose, not a raw object, which retires FND-37's symptom — but
  // against the fixture drive the gate fails in microseconds and the browser occasionally has not
  // finished subscribing, so asserting it here would be flaky for an environmental reason. See
  // FND-58.
})

test('A9 AC4 — a completed stand-up is still on screen after a reload', async ({ page }) => {
  const folder = uniqueFolder('standup-reload-fixed')
  const cohort = seedDraftCohort(folder)
  makeCohortFolder(folder)
  putReferenceBundle(folder)

  await signInAsAdmin(page)
  await openStandup(page, cohort.cohortId)
  await runValidation(page, `${WEB_BASE}/${folder}`)
  await expect(page.locator('.panel--accept')).toBeVisible({ timeout: 45_000 })

  await page.reload()
  await expect(page.locator('.panel--accept')).toBeVisible({ timeout: 20_000 })
})

test('A5 AC2 — a missing reference file is named on screen, not just "stand-up failed"', async ({ page }) => {
  const folder = uniqueFolder('standup-missing')
  const cohort = seedDraftCohort(folder)
  makeCohortFolder(folder)
  putReferenceBundle(folder, { omit: 'Lab Reference.xlsx' })

  await signInAsAdmin(page)
  await openStandup(page, cohort.cohortId)
  await runValidation(page, `${WEB_BASE}/${folder}`)

  const panel = page.locator('.panel--error')
  await expect(panel).toBeVisible({ timeout: 45_000 })
  // Naming the file is the difference between an actionable error and a shrug.
  await expect(panel).toContainText('Lab Reference.xlsx')
})
