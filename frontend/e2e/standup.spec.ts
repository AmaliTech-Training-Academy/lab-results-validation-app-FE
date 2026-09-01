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

test('FND-57 — a Gate 1 failure never reaches the screen (pins current behaviour)', async ({ page }) => {
  const folder = uniqueFolder('standup-bad')
  const cohort = seedDraftCohort(folder)
  // No folder on the drive at all, so Gate 1 cannot resolve the link. It fails in milliseconds.

  await signInAsAdmin(page)
  await openStandup(page, cohort.cohortId)
  await runValidation(page, `${WEB_BASE}/${folder}`)

  // Poll for the job's terminal state rather than waiting a fixed time — under load the fixed wait
  // expired before the job existed, which passed alone and failed in the suite.
  await expect(async () => {
    expect(sql(
      `SELECT status FROM cohort_standup_jobs WHERE cohort_id = '${cohort.cohortId}'
       ORDER BY started_at DESC LIMIT 1`)).toBe('FAILED')
  }).toPass({ timeout: 45_000 })

  // The backend did the right thing: the job is FAILED and every admin has been emailed. Give the
  // screen a further moment to catch up, so "it never arrives" is a fair claim and not a race.
  await page.waitForTimeout(8_000)

  // The screen does not. Every step still reads Pending, and no error panel appears. This assertion
  // is deliberately backwards — it pins the defect so the suite stays green and so the day someone
  // fixes it, this test fails and says so. See FND-57.
  const steps = await page.locator('.step-state').allTextContents()
  expect(steps.every((s) => /pending/i.test(s))).toBe(true)
  await expect(page.locator('.panel--error')).toHaveCount(0)

  // A3 AC2 — the cohort itself is correctly left alone, so a retry is possible.
  expect(sql(`SELECT lifecycle_state FROM cohorts WHERE id = '${cohort.cohortId}'`)).toBe('DRAFT')
})

test.fixme('A9 AC3 / A10 AC1 — a Gate 1 failure is shown and explained on screen', async ({ page }) => {
  // Enable when FND-57 is fixed, and delete the pin above.
  const folder = uniqueFolder('standup-bad-fixed')
  const cohort = seedDraftCohort(folder)

  await signInAsAdmin(page)
  await openStandup(page, cohort.cohortId)
  await runValidation(page, `${WEB_BASE}/${folder}`)

  const panel = page.locator('.panel--error')
  await expect(panel).toBeVisible({ timeout: 45_000 })
  const text = (await panel.innerText()).trim()
  // FND-37's fingerprints: the panel must read as words, not a dumped object.
  expect(text).not.toContain('[object Object]')
  expect(text).not.toMatch(/\{\s*"/)
  await expect(panel).toContainText(/G1-|cannot access|not a valid/i)
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
