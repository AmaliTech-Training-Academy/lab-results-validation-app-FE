import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import AdminHomeView from '@/views/admin/AdminHomeView.vue'
import type { Cohort } from '@/types/domain.types'
import type { IngestionRun } from '@/types/run.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/cohorts.service', () => ({
  listCohorts: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/runs.service', () => ({
  listRuns: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/audit.service', () => ({
  listAuditRuns: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/runReview.service', () => ({
  listCohortConflicts: vi.fn<() => Promise<unknown>>(),
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
 *  never populates with counts/highFailure (§ FND-46): a run can look totally clean from here alone. */
function shallowRun(over: Partial<IngestionRun> = {}): IngestionRun {
  return { id: 'job-1', cohortId: 'c1', cohortName: 'Cohort 7', status: 'completed', runAt: '2026-07-21T08:00:00Z', ...over }
}

/** Shape of an `/audit-log/ingestion-runs` row — has the real failure-rate/conflict/rejected-row signal. */
function auditRun(over: Partial<IngestionRun> = {}): IngestionRun {
  return {
    id: 'ir-1', cohortId: 'c1', syncJobId: 'job-1', status: 'completed', runAt: '2026-07-21T08:00:00Z',
    counts: { rowsRead: 10, committedNew: 10, updated: 0, skippedInvalid: 0, skippedUnchanged: 0, conflicts: 0 },
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
  vi.mocked(runReviewSvc.listCohortConflicts).mockResolvedValue(paged([]))
  vi.mocked(runReviewSvc.listConflicts).mockResolvedValue(conflictsPage(0))
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/dashboard', name: 'admin-dashboard', component: { template: '<div/>' } },
      { path: '/admin/cohorts', name: 'admin-cohorts', component: { template: '<div/>' } },
      { path: '/admin/runs', name: 'admin-runs', component: { template: '<div/>' } },
      { path: '/admin/runs/:id', name: 'admin-run-review', component: { template: '<div/>' } },
      { path: '/admin/audit', name: 'admin-audit', component: { template: '<div/>' } },
    ],
  })
  router.push({ name: 'admin-dashboard' })
  await router.isReady()
})

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AdminHomeView, { global: { plugins: [pinia, router] } })
  return { wrapper, pinia }
}

describe('AdminHomeView — Attention required (§ FND-46)', () => {
  it('surfaces a run with a high failure rate that the shallow job endpoint reports as merely "completed"', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun()]) // status: completed, no counts/highFailure at all
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([
      auditRun({ highFailure: true, counts: { rowsRead: 20, committedNew: 8, updated: 0, skippedInvalid: 12, skippedUnchanged: 0, conflicts: 0 } }),
    ]))
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Nothing needs attention')
    expect(wrapper.text()).toContain('Cohort 7')
    expect(wrapper.text()).toContain('% of submissions rejected')
    expect(wrapper.text()).toContain('1 need')
  })

  it('surfaces a run with unresolved conflicts that the shallow job endpoint has no conflict count for', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([
      auditRun({ counts: { rowsRead: 10, committedNew: 8, updated: 0, skippedInvalid: 0, skippedUnchanged: 0, conflicts: 3 } }),
    ]))
    vi.mocked(runReviewSvc.listConflicts).mockResolvedValue(conflictsPage(3)) // still PENDING, none resolved yet
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('3 unresolved conflicts')
  })

  it('drops a run from Attention once every one of its conflicts has been resolved or rejected', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun()])
    // The historical snapshot still says 3 (never decremented server-side) — but every one has since
    // been resolved/rejected, so the live PENDING count is 0.
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([
      auditRun({ counts: { rowsRead: 10, committedNew: 8, updated: 0, skippedInvalid: 0, skippedUnchanged: 0, conflicts: 3 } }),
    ]))
    vi.mocked(runReviewSvc.listConflicts).mockResolvedValue(conflictsPage(0))
    const { wrapper } = mountView()
    await flushPromises()

    expect(runReviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'job-1', { status: 'PENDING', size: 1 })
    expect(wrapper.text()).not.toContain('unresolved conflict')
    expect(wrapper.text()).toContain('Nothing needs attention')
  })

  it('surfaces a run that rejected rows without qualifying as a high failure rate', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([
      auditRun({ highFailure: false, counts: { rowsRead: 40, committedNew: 38, updated: 0, skippedInvalid: 2, skippedUnchanged: 0, conflicts: 0 } }),
    ]))
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('2 rows rejected')
  })

  it('still flags a run the job endpoint reports as outright failed, even with no audit data', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun({ status: 'failed' })])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([]))
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Run failed')
  })

  it('reports nothing needs attention when every run is genuinely clean', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([auditRun()]))
    const { wrapper } = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Nothing needs attention')
  })

  it('only fans the attention fetch out to STOOD_UP cohorts', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort(), cohort({ id: 'c2', lifecycleState: 'DRAFT' })])
    vi.mocked(runsSvc.listRuns).mockResolvedValue([shallowRun()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(paged([]))
    mountView()
    await flushPromises()

    expect(auditSvc.listAuditRuns).toHaveBeenCalledTimes(1)
    expect(auditSvc.listAuditRuns).toHaveBeenCalledWith({ cohortId: 'c1', size: 20 })
  })
})
