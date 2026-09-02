import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRunsStore } from '@/stores/runs'
import type { IngestionRun } from '@/types/run.types'

vi.mock('@/services/runs.service', () => ({
  listRuns: vi.fn<() => Promise<unknown>>(),
  getRun: vi.fn<() => Promise<unknown>>(),
  triggerSync: vi.fn<() => Promise<unknown>>(),
  triggerSyncAll: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/runReview.service', () => ({
  getRunCounts: vi.fn<() => Promise<unknown>>(),
  listConflicts: vi.fn<() => Promise<unknown>>(),
}))
import * as runReviewSvc from '@/services/runReview.service'

function conflictsPage(totalElements: number) {
  return { content: [], number: 0, size: 1, totalElements, totalPages: 1, last: true }
}

/** Shape of `runs.list` — the shallow `/cohorts/{id}/sync/runs` job endpoint, which never carries
 *  counts (§ FND-39): a completed run can look totally empty from here alone. */
function run(over: Partial<IngestionRun> = {}): IngestionRun {
  return { id: 'job-1', cohortId: 'c1', status: 'completed', runAt: '2026-07-21T08:00:00Z', ...over }
}

function counts(over: Partial<Record<string, number>> = {}) {
  return {
    counts: { rowsRead: 10, committedNew: 8, updated: 0, skippedInvalid: 0, skippedUnchanged: 2, conflicts: 0, ...over },
    highFailure: false,
    failed: false,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useRunsStore.fetchStats (§ FND-55)', () => {
  it('fetches per-run counts scoped to exactly the runs passed in, not a fixed recency window', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockResolvedValue(counts({ committedNew: 5 }))

    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-1', cohortId: 'c1' })])

    expect(runReviewSvc.getRunCounts).toHaveBeenCalledWith('c1', 'job-1')
    expect(store.stats.get('job-1')).toEqual(counts({ committedNew: 5 }))
  })

  it('covers a run far older than any fixed page window, as long as it is passed in', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockResolvedValue(counts({ committedNew: 3 }))

    const store = useRunsStore()
    // This run would never have appeared in a page-0/size-20 file-level fetch for a busy cohort —
    // the whole point of § FND-55 is that scoping by run id, not by a fixed window, doesn't care.
    await store.fetchStats([run({ id: 'job-ancient', cohortId: 'c1' })])

    expect(store.stats.get('job-ancient')?.counts.committedNew).toBe(3)
  })

  it('uses syncJobId over id when both are present (audit-log-shaped rows)', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockResolvedValue(counts())

    const store = useRunsStore()
    await store.fetchStats([run({ id: 'ir-1', syncJobId: 'job-9', cohortId: 'c1' })])

    expect(runReviewSvc.getRunCounts).toHaveBeenCalledWith('c1', 'job-9')
  })

  it('fetches every distinct run in parallel and keys results by run id', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockImplementation(async (cohortId, jobId) =>
      counts({ committedNew: jobId === 'job-1' ? 1 : 2 }),
    )

    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-1' }), run({ id: 'job-2' })])

    expect(runReviewSvc.getRunCounts).toHaveBeenCalledTimes(2)
    expect(store.stats.get('job-1')?.counts.committedNew).toBe(1)
    expect(store.stats.get('job-2')?.counts.committedNew).toBe(2)
  })

  it('flags failed from the overview response', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockResolvedValue({ ...counts(), failed: true })

    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-2', status: 'failed' })])

    expect(store.stats.get('job-2')?.failed).toBe(true)
  })

  it('is a no-op for an empty list', async () => {
    const store = useRunsStore()
    await store.fetchStats([])

    expect(runReviewSvc.getRunCounts).not.toHaveBeenCalled()
    expect(store.stats.size).toBe(0)
  })

  it('skips a run whose stats are already cached', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockResolvedValue(counts())
    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-1', status: 'completed' })])
    expect(runReviewSvc.getRunCounts).toHaveBeenCalledTimes(1)

    await store.fetchStats([run({ id: 'job-1', status: 'completed' })])

    expect(runReviewSvc.getRunCounts).toHaveBeenCalledTimes(1) // still cached — not refetched
  })

  it('always refetches a still-processing run, since its counts can still be climbing', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockResolvedValue(counts())
    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-1', status: 'processing' })])
    await store.fetchStats([run({ id: 'job-1', status: 'processing' })])

    expect(runReviewSvc.getRunCounts).toHaveBeenCalledTimes(2)
  })

  it('leaves one failed run unfetched (a dash, not a false zero) without blocking the others', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockImplementation(async (_cohortId, jobId) =>
      jobId === 'job-bad' ? Promise.reject(new Error('boom')) : counts({ committedNew: 4 }),
    )

    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-bad' }), run({ id: 'job-good' })])

    expect(store.stats.has('job-bad')).toBe(false)
    expect(store.stats.get('job-good')?.counts.committedNew).toBe(4)
  })

  it('sets statsError only when every run in the batch fails', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockRejectedValue(new Error('boom'))

    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-1' })])

    expect(store.stats.size).toBe(0)
    expect(store.statsError).toBeTruthy()
    expect(store.statsLoading).toBe(false)
  })

  it('does not set statsError when at least one run in the batch succeeds', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockImplementation(async (_cohortId, jobId) =>
      jobId === 'job-bad' ? Promise.reject(new Error('boom')) : counts(),
    )

    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-bad' }), run({ id: 'job-good' })])

    expect(store.statsError).toBeNull()
  })
})

describe('useRunsStore.fetchStats — live conflict count once resolved/rejected', () => {
  it('replaces the stale snapshot count with the live PENDING count once every conflict is resolved', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockResolvedValue(counts({ conflicts: 2 }))
    // The overview snapshot still says 2 — the admin resolved both since ingestion.
    vi.mocked(runReviewSvc.listConflicts).mockResolvedValue(conflictsPage(0))

    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-1' })])

    expect(runReviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'job-1', { status: 'PENDING', size: 1 })
    expect(store.stats.get('job-1')?.counts.conflicts).toBe(0)
  })

  it('shows the live count when some but not all conflicts on a run are resolved', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockResolvedValue(counts({ conflicts: 3 }))
    vi.mocked(runReviewSvc.listConflicts).mockResolvedValue(conflictsPage(1))

    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-1' })])

    expect(store.stats.get('job-1')?.counts.conflicts).toBe(1)
  })

  it('never calls the live-count endpoint for a run the snapshot says had zero conflicts', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockResolvedValue(counts()) // conflicts: 0 by default
    const store = useRunsStore()

    await store.fetchStats([run({ id: 'job-1' })])

    expect(runReviewSvc.listConflicts).not.toHaveBeenCalled()
    expect(store.stats.get('job-1')?.counts.conflicts).toBe(0)
  })

  it('falls back to the snapshot count for just the one job whose live lookup fails', async () => {
    vi.mocked(runReviewSvc.getRunCounts).mockImplementation(async (_cohortId, jobId) =>
      jobId === 'job-1' ? counts({ conflicts: 2 }) : counts({ conflicts: 1 }),
    )
    vi.mocked(runReviewSvc.listConflicts).mockImplementation(async (_cohortId, jobId) =>
      jobId === 'job-1' ? Promise.reject(new Error('boom')) : conflictsPage(0),
    )

    const store = useRunsStore()
    await store.fetchStats([run({ id: 'job-1' }), run({ id: 'job-2', cohortId: 'c1' })])

    // job-1's live lookup failed — keeps its overview snapshot (2) rather than losing the row entirely.
    expect(store.stats.get('job-1')?.counts.conflicts).toBe(2)
    // job-2's succeeded — its resolved conflict no longer counts.
    expect(store.stats.get('job-2')?.counts.conflicts).toBe(0)
  })
})
