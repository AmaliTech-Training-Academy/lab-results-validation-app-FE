import { expect, test } from '@playwright/test'
import { signInAsAdmin, uniqueFolder } from './helpers'
import { seedCohortForGrading, seedCompletedRunWithRejections } from './seed'

/**
 * Journeys 5 and 7 — do the screens tell the truth about a run that rejected rows?
 *
 * <p>These are the two findings that have waited longest for a retest. FND-39: the grading-runs
 * list showed `0 invalid` for a run that had rejections, because the list endpoint carries no
 * counts and the screen rendered a confident zero for data it never fetched. FND-46: the
 * dashboard's "Attention required" panel could only see a run that failed outright, so a run that
 * rejected rows looked perfectly healthy on the first screen an admin opens. Both were reported
 * fixed in code in August; neither had been run since.
 */

const folder = uniqueFolder('runs')
let cohortName: string

test.beforeAll(() => {
  const cohort = seedCohortForGrading(folder)
  cohortName = cohort.name
  seedCompletedRunWithRejections(cohort.cohortId)
})

test('FND-39 — the runs list reports the rejection rather than a confident zero', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/runs')

  const row = page.locator('tr', { hasText: cohortName }).first()
  await expect(row).toBeVisible({ timeout: 20_000 })

  // The defect was a hard-coded-looking "0 invalid" on a run that rejected a row. One is the truth.
  await expect(row).toContainText('1 invalid')
  await expect(row).toContainText('1 new')
})

test('FND-46 — the dashboard shows the run under Attention required', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/dashboard')

  // The panel is a div.card, not a <section> — located by its heading so a class rename in the
  // shared UI kit cannot silently break this.
  const attention = page.locator('div.card', { has: page.getByRole('heading', { name: 'Attention required' }) })
  await expect(attention).toBeVisible({ timeout: 20_000 })

  // The original defect: a run that rejected rows was invisible here, so an admin's first screen
  // said everything was fine when it was not.
  await expect(attention).not.toContainText('Nothing needs attention right now')
  await expect(attention).toContainText(cohortName)
})

test('D5 — the audit log lists the run and opens its row-level detail', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/audit')

  // D5 AC1/AC2 were both static verdicts: the audit view is a published surface the data team reads,
  // and nobody had opened it.
  await expect(page.locator('body')).toContainText(cohortName, { timeout: 20_000 })
  await expect(page.locator('body')).toContainText('Module 1 Grading.xlsx')
})
