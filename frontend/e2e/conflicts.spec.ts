import { expect, test } from '@playwright/test'
import { signInAsAdmin, uniqueFolder } from './helpers'
import {
  GRADING, seedCohortForGrading, seedCompletedRunWithRejections, seedLab, seedLearner,
  seedPendingConflict,
} from './seed'

/**
 * Journey 6 — a duplicate mark, seen and decided on screen.
 *
 * <p>Two findings live here and both are on the retest list. FND-47: the queue showed database ids
 * and a blob of JSON, so the two options looked identical and an admin could not tell them apart.
 * FND-49: the screen could not send *which* mark was chosen, so "keep incoming" failed outright and
 * the queue could not be cleared at all. The backend half is covered by
 * ConflictResolutionIntegrationTest; this is the half that needs a browser.
 */

const folder = uniqueFolder('conflict')
let jobId: string
let cohortId: string

/**
 * The run-review URL carries the cohort as a query parameter. Without it the page loads and the API
 * rejects the request — worth knowing, because it looks like a broken page and is not: arriving by
 * clicking a row in the runs list adds it, and a reload then works.
 */
function runReviewUrl(): string {
  return `/admin/runs/${jobId}?cohortId=${cohortId}`
}

test.beforeAll(() => {
  const cohort = seedCohortForGrading(folder)
  cohortId = cohort.cohortId
  const labId = seedLab(cohort.moduleId, 'Duplicate Lab')
  const learnerId = seedLearner(cohort.cohortId, cohort.specializationId, GRADING.learners[0])
  const run = seedCompletedRunWithRejections(cohort.cohortId, { rejected: 0, conflicts: 1 })
  jobId = run.jobId
  seedPendingConflict(cohort.cohortId, run.runId, learnerId, labId)
})

test('FND-47 — the queue shows both marks and who they belong to, not raw ids', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto(runReviewUrl())

  const queue = page.locator('section', { has: page.getByRole('heading', { name: /Conflict queue/i }) })
  await expect(queue).toBeVisible({ timeout: 20_000 })

  const row = queue.locator('tr', { hasText: GRADING.learners[0] }).first()
  await expect(row).toBeVisible()
  // The point of FND-47: an admin has to be able to tell the two options apart. Both marks on
  // screen, and the learner named rather than a database id.
  await expect(row).toContainText('62')
  await expect(row).toContainText('91')
  await expect(row).toContainText('Duplicate Lab')
  await expect(row).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/)
})

test('FND-49 — a duplicate can actually be resolved from the screen', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto(runReviewUrl())

  const queue = page.locator('section', { has: page.getByRole('heading', { name: /Conflict queue/i }) })
  const row = queue.locator('tr', { hasText: GRADING.learners[0] }).first()
  await row.getByRole('button', { name: /review/i }).click()

  // Pick the higher mark explicitly. Before the fix the screen had no way to say which, so the
  // request failed and the queue could not be cleared at all.
  await page.getByText('91', { exact: false }).last().click()
  await page.getByRole('button', { name: /keep|confirm|save/i }).first().click()

  await expect(async () => {
    await page.reload()
    await expect(queue.locator('tr', { hasText: GRADING.learners[0] }).first())
      .toContainText('RESOLVED')
  }).toPass({ timeout: 30_000 })
})
