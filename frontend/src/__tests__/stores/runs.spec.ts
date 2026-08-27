import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRunsStore } from '@/stores/runs'
import type { IngestionRun } from '@/types/run.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/runs.service', () => ({
  listRuns: vi.fn<() => Promise<unknown>>(),
  getRun: vi.fn<() => Promise<unknown>>(),
  triggerSync: vi.fn<() => Promise<unknown>>(),
  triggerSyncAll: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/audit.service', () => ({
  listAuditRuns: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/runReview.service', () => ({
  listConflicts: vi.fn<() => Promise<unknown>>(),
}))
import * as auditSvc from '@/services/audit.service'
import * as runReviewSvc from '@/services/runReview.service'

function conflictsPage(totalElements: number) {
  return { content: [], number: 0, size: 1, totalElements, totalPages: 1, last: true }
}

/** Mirrors the real `/audit-log/ingestion-runs` shape mapped into `IngestionRun` — one row per file. */
function auditRun(over: Partial<IngestionRun> = {}): IngestionRun {
  return {
    id: 'ir-1', cohortId: 'c1', syncJobId: 'job-1', status: 'completed', runAt: '2026-07-21T08:00:00Z',
    counts: { rowsRead: 10, committedNew: 8, updated: 0, skippedInvalid: 0, skippedUnchanged: 2, conflicts: 0 },
    highFailure: false,
    ...over,
  }
}

function page(content: IngestionRun[]): Paged<IngestionRun> {
  return { content, number: 0, size: 20, totalElements: content.length, totalPages: 1, last: true }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useRunsStore.fetchStats', () => {
  it('groups per-file audit rows into one stats signal per sync job, summing every count field (§ FND-39, § FND-46)', async () => {
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(page([
      auditRun({
        id: 'ir-1', syncJobId: 'job-1', highFailure: true,
        counts: { rowsRead: 20, committedNew: 5, updated: 1, skippedInvalid: 10, skippedUnchanged: 4, conflicts: 1 },
      }),
      auditRun({
        id: 'ir-2', syncJobId: 'job-1', highFailure: false,
        counts: { rowsRead: 5, committedNew: 5, updated: 0, skippedInvalid: 0, skippedUnchanged: 0, conflicts: 2 },
      }),
    ]))
    // Nothing resolved yet — the live PENDING count matches the historical snapshot's sum (1 + 2).
    vi.mocked(runReviewSvc.listConflicts).mockResolvedValue(conflictsPage(3))

    const store = useRunsStore()
    await store.fetchStats(['c1'])

    expect(auditSvc.listAuditRuns).toHaveBeenCalledWith({ cohortId: 'c1', size: 20 })
    const s = store.stats.get('job-1')
    // highFailure ORs across files; every count field sums across files in the same job.
    expect(s).toEqual({
      highFailure: true,
      failed: false,
      counts: { rowsRead: 25, committedNew: 10, updated: 1, skippedInvalid: 10, skippedUnchanged: 4, conflicts: 3 },
    })
  })

  it('flags failed when any file in the job reports status failed', async () => {
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(page([
      auditRun({ id: 'ir-1', syncJobId: 'job-2', status: 'failed' }),
    ]))

    const store = useRunsStore()
    await store.fetchStats(['c1'])

    expect(store.stats.get('job-2')?.failed).toBe(true)
  })

  it('fans out per cohort id in parallel and merges the results', async () => {
    vi.mocked(auditSvc.listAuditRuns)
      .mockImplementation(async ({ cohortId } = {}) =>
        page([auditRun({ id: `ir-${cohortId}`, syncJobId: `job-${cohortId}`, cohortId: cohortId as string })]),
      )

    const store = useRunsStore()
    await store.fetchStats(['c1', 'c2'])

    expect(auditSvc.listAuditRuns).toHaveBeenCalledTimes(2)
    expect(store.stats.has('job-c1')).toBe(true)
    expect(store.stats.has('job-c2')).toBe(true)
  })

  it('skips the fetch and clears stats when there are no eligible cohorts', async () => {
    const store = useRunsStore()
    store.stats.set('stale', {
      highFailure: true, failed: false,
      counts: { rowsRead: 0, committedNew: 0, updated: 0, skippedInvalid: 0, skippedUnchanged: 0, conflicts: 0 },
    })

    await store.fetchStats([])

    expect(auditSvc.listAuditRuns).not.toHaveBeenCalled()
    expect(store.stats.size).toBe(0)
  })

  it('falls back to an empty map so a load failure does not block the rest of the page', async () => {
    vi.mocked(auditSvc.listAuditRuns).mockRejectedValue(new Error('boom'))

    const store = useRunsStore()
    await expect(store.fetchStats(['c1'])).resolves.toBeUndefined()

    expect(store.stats.size).toBe(0)
    expect(store.statsLoading).toBe(false)
  })
})

describe('useRunsStore.fetchStats — live conflict count once resolved/rejected', () => {
  it('replaces the stale snapshot count with the live PENDING count once every conflict is resolved', async () => {
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(page([
      auditRun({ syncJobId: 'job-1', counts: { rowsRead: 10, committedNew: 8, updated: 0, skippedInvalid: 0, skippedUnchanged: 0, conflicts: 2 } }),
    ]))
    // The historical snapshot still says 2 — the admin resolved both since ingestion.
    vi.mocked(runReviewSvc.listConflicts).mockResolvedValue(conflictsPage(0))

    const store = useRunsStore()
    await store.fetchStats(['c1'])

    expect(runReviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'job-1', { status: 'PENDING', size: 1 })
    expect(store.stats.get('job-1')?.counts.conflicts).toBe(0)
  })

  it('shows the live count when some but not all conflicts on a run are resolved', async () => {
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(page([
      auditRun({ syncJobId: 'job-1', counts: { rowsRead: 10, committedNew: 8, updated: 0, skippedInvalid: 0, skippedUnchanged: 0, conflicts: 3 } }),
    ]))
    vi.mocked(runReviewSvc.listConflicts).mockResolvedValue(conflictsPage(1))

    const store = useRunsStore()
    await store.fetchStats(['c1'])

    expect(store.stats.get('job-1')?.counts.conflicts).toBe(1)
  })

  it('never calls the live-count endpoint for a run the snapshot says had zero conflicts', async () => {
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(page([auditRun({ syncJobId: 'job-1' })])) // conflicts: 0 by default
    const store = useRunsStore()

    await store.fetchStats(['c1'])

    expect(runReviewSvc.listConflicts).not.toHaveBeenCalled()
    expect(store.stats.get('job-1')?.counts.conflicts).toBe(0)
  })

  it('falls back to the snapshot count for just the one job whose live lookup fails', async () => {
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(page([
      auditRun({ id: 'ir-1', syncJobId: 'job-1', counts: { rowsRead: 10, committedNew: 8, updated: 0, skippedInvalid: 0, skippedUnchanged: 0, conflicts: 2 } }),
      auditRun({ id: 'ir-2', syncJobId: 'job-2', cohortId: 'c1', counts: { rowsRead: 5, committedNew: 5, updated: 0, skippedInvalid: 0, skippedUnchanged: 0, conflicts: 1 } }),
    ]))
    vi.mocked(runReviewSvc.listConflicts).mockImplementation(async (_cohortId, jobId) =>
      jobId === 'job-1' ? Promise.reject(new Error('boom')) : conflictsPage(0),
    )

    const store = useRunsStore()
    await store.fetchStats(['c1'])

    // job-1's live lookup failed — keeps its historical snapshot (2) rather than losing the row entirely.
    expect(store.stats.get('job-1')?.counts.conflicts).toBe(2)
    // job-2's succeeded — its resolved conflict no longer counts.
    expect(store.stats.get('job-2')?.counts.conflicts).toBe(0)
  })
})
