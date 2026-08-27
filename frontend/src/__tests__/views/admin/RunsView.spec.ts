import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import RunsView from '@/views/admin/RunsView.vue'
import type { Cohort } from '@/types/domain.types'
import type { IngestionRun } from '@/types/run.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/cohorts.service', () => ({
  listCohorts: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/runs.service', () => ({
  listRuns: vi.fn<() => Promise<unknown>>(),
  triggerSync: vi.fn<() => Promise<unknown>>(),
  triggerSyncAll: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/audit.service', () => ({
  listAuditRuns: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/runReview.service', () => ({
  listConflicts: vi.fn<() => Promise<unknown>>(),
}))
import * as cohortsSvc from '@/services/cohorts.service'
import * as runsSvc from '@/services/runs.service'
import * as auditSvc from '@/services/audit.service'
import * as runReviewSvc from '@/services/runReview.service'

function conflictsPage(totalElements: number) {
  return { content: [], number: 0, size: 1, totalElements, totalPages: 1, last: true }
}

function cohort(over: Partial<Cohort> = {}): Cohort {
  return {
    id: 'c1', name: 'Cohort 7', startDate: '2026-06-01', endDate: '2026-12-01',
    lifecycleState: 'STOOD_UP', locked: false, active: true, sharepointFolderUrl: null, createdAt: '2026-06-01T00:00:00Z',
    ...over,
  }
}

/** Shape of `runs.list` — the shallow `/cohorts/{id}/sync/runs` job endpoint, which the real backend
 *  never populates with counts (§ FND-39): a completed run can look totally empty from here alone. */
function shallowRun(over: Partial<IngestionRun> = {}): IngestionRun {
  return { id: 'job-1', cohortId: 'c1', cohortName: 'Cohort 7', status: 'completed', runAt: '2026-07-21T08:00:00Z', ...over }
}

function auditRun(over: Partial<IngestionRun> = {}): IngestionRun {
  return {
    id: 'ir-1', cohortId: 'c1', syncJobId: 'job-1', status: 'completed', runAt: '2026-07-21T08:00:00Z',
    counts: { rowsRead: 30, committedNew: 12, updated: 2, skippedInvalid: 14, skippedUnchanged: 2, conflicts: 1 },
    highFailure: false,
    ...over,
  }
}

function paged<T>(content: T[]): Paged<T> {
  return { content, number: 0, size: 20, totalElements: content.length, totalPages: 1, last: true }
}

let router: Router
beforeEach(async () => {
  vi.clearAllMocks()
  // Default: whatever a run's historical conflicts snapshot says, treat it all as still PENDING —
  // individual tests override this to prove the "resolved conflicts drop off" behavior.
  vi.mocked(runReviewSvc.listConflicts).mockImplementation(async () => conflictsPage(1))
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/runs', name: 'admin-runs', component: { template: '<div/>' } },
      { path: '/admin/runs/:id', name: 'admin-run-review', component: { template: '<div/>' } },
    ],
  })
  router.push({ name: 'admin-runs' })
  await router.isReady()
})

let activeWrapper: ReturnType<typeof mount> | null = null
afterEach(() => {
  // Background polling (§ FND-38) schedules real setTimeout/fake-timer callbacks tied to the mounted
  // component — leaving one running across tests would fire against a torn-down instance/stale mocks.
  activeWrapper?.unmount()
  activeWrapper = null
  vi.useRealTimers()
})

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(RunsView, { global: { plugins: [pinia, router] } })
  activeWrapper = wrapper
  return { wrapper, pinia }
}

describe('RunsView — Results column (§ FND-39)', () => {
  it('shows real counts from the audit log, not the zeros the shallow job endpoint reports', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun()]) // no counts at all
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([auditRun()]))
    const { wrapper } = mountView()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('12 new')
    expect(text).toContain('2 upd')
    expect(text).toContain('14 invalid')
    expect(text).toContain('1 conflict')
  })

  it('sums counts across every file in a multi-workbook sync job', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([
      auditRun({ id: 'ir-1', counts: { rowsRead: 10, committedNew: 5, updated: 1, skippedInvalid: 2, skippedUnchanged: 2, conflicts: 0 } }),
      auditRun({ id: 'ir-2', counts: { rowsRead: 8, committedNew: 3, updated: 0, skippedInvalid: 1, skippedUnchanged: 4, conflicts: 1 } }),
    ]))
    const { wrapper } = mountView()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('8 new') // 5 + 3
    expect(text).toContain('1 upd')
    expect(text).toContain('3 invalid') // 2 + 1
    expect(text).toContain('1 conflict')
  })

  it('falls back to zero, not a crash, for a run the audit log has no data for yet', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun({ id: 'job-brand-new', status: 'processing' })])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([]))
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('0 new')
  })

  it('"Try again" reloads both the run list and its stats', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockRejectedValueOnce(new Error('Network error'))
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([auditRun()]))
    const { wrapper } = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Could not load runs')

    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun()])
    await wrapper.findAll('button').find((b) => b.text() === 'Try again')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('12 new')
  })

  it('shows 0 conflicts once every conflict on the run has been resolved or rejected, even though the historical snapshot still says otherwise', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([auditRun({ counts: { rowsRead: 30, committedNew: 12, updated: 2, skippedInvalid: 14, skippedUnchanged: 2, conflicts: 2 } })]))
    vi.mocked(runReviewSvc.listConflicts).mockResolvedValue(conflictsPage(0))
    const { wrapper } = mountView()
    await flushPromises()

    expect(runReviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'job-1', { status: 'PENDING', size: 1 })
    expect(wrapper.text()).toContain('0 conflict')
    expect(wrapper.text()).not.toContain('2 conflict')
  })
})

describe('RunsView — live status polling while a run is processing (§ FND-38)', () => {
  it('silently re-polls while a run is processing, and stops once it finishes', async () => {
    vi.useFakeTimers()
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValueOnce([shallowRun({ status: 'processing' })])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([]))
    const { wrapper } = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Processing')

    vi.mocked(runsSvc.listRuns).mockResolvedValueOnce([shallowRun({ status: 'completed' })])
    await vi.advanceTimersByTimeAsync(8000)
    await flushPromises()

    expect(runsSvc.listRuns).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Completed')
    expect(wrapper.text()).not.toContain('Processing')

    // Nothing left to wait on — advancing further shouldn't trigger a third fetch.
    await vi.advanceTimersByTimeAsync(8000)
    expect(runsSvc.listRuns).toHaveBeenCalledTimes(2)
  })

  it('does not show the loading skeleton during a silent background poll', async () => {
    vi.useFakeTimers()
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun({ status: 'processing' })])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([]))
    const { wrapper } = mountView()
    await flushPromises()

    await vi.advanceTimersByTimeAsync(8000)
    await flushPromises()

    expect(wrapper.find('.skel-row').exists()).toBe(false)
    expect(wrapper.text()).toContain('Processing')
  })

  it('never polls when nothing is processing', async () => {
    vi.useFakeTimers()
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun({ status: 'completed' })])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([]))
    mountView()
    await flushPromises()

    await vi.advanceTimersByTimeAsync(20_000)

    expect(runsSvc.listRuns).toHaveBeenCalledTimes(1)
  })

  it('stops polling once the component unmounts, so it never fires against a torn-down page', async () => {
    vi.useFakeTimers()
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun({ status: 'processing' })])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([]))
    const { wrapper } = mountView()
    await flushPromises()

    wrapper.unmount()
    activeWrapper = null // already unmounted here — afterEach shouldn't unmount it a second time
    await vi.advanceTimersByTimeAsync(30_000)

    expect(runsSvc.listRuns).toHaveBeenCalledTimes(1)
  })

  it('starts polling for the newly triggered run after a manual sync', async () => {
    vi.useFakeTimers()
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([]) // nothing yet — no polling on initial load
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([]))
    vi.mocked(runsSvc.triggerSync).mockResolvedValue({ triggered: 1, skipped: 0, triggeredCohortIds: ['c1'] })
    const { wrapper } = mountView()
    await flushPromises()
    expect(runsSvc.listRuns).toHaveBeenCalledTimes(1)

    // The sync trigger's own re-list (inside runs.sync()) now reports the new run as processing.
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun({ status: 'processing' })])
    await wrapper.findAll('button').find((b) => b.text().includes('Run sync now'))!.trigger('click')
    await flushPromises()
    expect(runsSvc.listRuns).toHaveBeenCalledTimes(2) // the sync's own re-list

    await vi.advanceTimersByTimeAsync(8000)
    await flushPromises()

    expect(runsSvc.listRuns).toHaveBeenCalledTimes(3) // picked up polling off the back of the trigger
  })
})
