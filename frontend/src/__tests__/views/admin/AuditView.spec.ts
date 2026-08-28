import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia } from 'pinia'
import AuditView from '@/views/admin/AuditView.vue'
import type { IngestionRun } from '@/types/run.types'
import type { Cohort, CohortReference, InstructorContact } from '@/types/domain.types'
import type { AuditEvent } from '@/types/audit.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/audit.service', () => ({
  listAuditRuns: vi.fn<() => Promise<unknown>>(),
  listAuditEvents: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/cohorts.service', () => ({
  listCohorts: vi.fn<() => Promise<unknown>>(),
  getCohortReference: vi.fn<() => Promise<unknown>>(),
}))
import * as auditSvc from '@/services/audit.service'
import * as cohortsSvc from '@/services/cohorts.service'

function cohort(over: Partial<Cohort> = {}): Cohort {
  return {
    id: 'c1', name: 'Cohort 7', startDate: '2026-01-01', endDate: '2026-06-01',
    lifecycleState: 'STOOD_UP', locked: false, active: true, sharepointFolderUrl: null, createdAt: '2026-01-01',
    ...over,
  }
}

function instructor(over: Partial<InstructorContact> = {}): InstructorContact {
  return { id: 'ins-1', instructorId: 'INS-001', email: 'sarah.jenkins@amalitech.com', fullName: 'Sarah Jenkins', active: true, ...over }
}

function reference(over: Partial<CohortReference> = {}): CohortReference {
  return { specializations: [], learners: [], instructors: [instructor()], ...over }
}

function run(over: Partial<IngestionRun> = {}): IngestionRun {
  return { id: 'run-1', cohortId: 'c1', status: 'completed', runAt: '2026-07-20T08:00:00Z', ...over }
}

function runsPage(overrides: Partial<Paged<IngestionRun>> = {}): Paged<IngestionRun> {
  return { content: [run()], number: 0, size: 20, totalElements: 1, totalPages: 1, last: true, ...overrides }
}

function event(over: Partial<AuditEvent> = {}): AuditEvent {
  return { id: 'ev-1', eventType: 'STOOD_UP', cohortId: 'c1', actorEmail: 'admin@amalitech.com', occurredAt: '2026-07-20T08:00:00Z', ...over }
}

function eventsPage(overrides: Partial<Paged<AuditEvent>> = {}): Paged<AuditEvent> {
  return { content: [event()], number: 0, size: 20, totalElements: 1, totalPages: 1, last: true, ...overrides }
}

let router: Router
beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(cohortsSvc.getCohortReference).mockResolvedValue(reference())
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/audit', name: 'admin-audit', component: { template: '<div/>' } },
      { path: '/admin/audit/events/:id', name: 'admin-audit-event', component: { template: '<div/>' } },
      { path: '/admin/runs/:id', name: 'admin-run-review', component: { template: '<div/>' } },
    ],
  })
  router.push({ name: 'admin-audit' })
  await router.isReady()
})

function mountView() {
  return mount(AuditView, { global: { plugins: [createPinia(), router] } })
}

async function goToEventsTab(wrapper: ReturnType<typeof mountView>) {
  await wrapper.findAll('button[role="tab"]').find((b) => b.text().includes('Lifecycle events'))!.trigger('click')
  await flushPromises()
}

describe('AuditView', () => {
  it('falls back to the cohorts store name when a run has no denormalized cohortName', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [run({ cohortName: undefined })] }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Cohort 7')
  })

  it('shows the workbook filename as its own column', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [run({ workbookFilename: 'FE_Lab_Grading.xlsx' })] }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    const headers = wrapper.findAll('th').map((h) => h.text())
    expect(headers).toContain('Workbook')
    expect(wrapper.text()).toContain('FE_Lab_Grading.xlsx')
  })

  it('falls back to a dash when a run has no workbook filename', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [run({ workbookFilename: undefined })] }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    const cells = wrapper.findAll('tbody tr.row-click td')
    expect(cells[1]!.text()).toBe('—')
  })

  it('opens the parent sync run review page using syncJobId — not the ingestion-run id itself — scoped to its cohort', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [run({ id: 'run-1', syncJobId: 'job-42', cohortId: 'c1' })] }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('tbody tr.row-click').trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text() === 'Open run review')!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('admin-run-review')
    expect(router.currentRoute.value.params.id).toBe('job-42')
    expect(router.currentRoute.value.params.id).not.toBe('run-1')
    expect(router.currentRoute.value.query.cohortId).toBe('c1')
  })

  it('hides the "Open run review" link when a run has no syncJobId, rather than linking to a broken page', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [run({ syncJobId: undefined })] }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('tbody tr.row-click').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('button').some((b) => b.text() === 'Open run review')).toBe(false)
  })

  it('re-fetches both tabs with the chosen cohortId when the cohort filter changes', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [], totalElements: 0 }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('select').setValue('c1')
    await flushPromises()

    expect(auditSvc.listAuditRuns).toHaveBeenLastCalledWith(expect.objectContaining({ cohortId: 'c1' }))
    expect(auditSvc.listAuditEvents).toHaveBeenLastCalledWith(expect.objectContaining({ cohortId: 'c1' }))
  })

  it('populates the instructor filter by fanning out the per-cohort reference endpoint over every stood-up cohort, deduping by id, labeled by name only', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([
      cohort({ id: 'c1', lifecycleState: 'STOOD_UP' }),
      cohort({ id: 'c2', lifecycleState: 'STOOD_UP' }),
      cohort({ id: 'c3', lifecycleState: 'DRAFT' as Cohort['lifecycleState'] }),
    ])
    vi.mocked(cohortsSvc.getCohortReference).mockImplementation(async (cohortId: string) =>
      cohortId === 'c1'
        ? reference({ instructors: [instructor({ id: 'ins-1', fullName: 'Sarah Jenkins' })] })
        : reference({ instructors: [instructor({ id: 'ins-1', fullName: 'Sarah Jenkins' }), instructor({ id: 'ins-2', fullName: 'David Kim', instructorId: 'INS-002' })] }),
    )
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [], totalElements: 0 }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    expect(cohortsSvc.getCohortReference).toHaveBeenCalledWith('c1')
    expect(cohortsSvc.getCohortReference).toHaveBeenCalledWith('c2')
    expect(cohortsSvc.getCohortReference).not.toHaveBeenCalledWith('c3')
    const instructorSelect = wrapper.findAll('.fld').find((f) => f.text().includes('Instructor'))!.find('select')
    const options = instructorSelect.findAll('option').map((o) => o.text())
    // labeled by full name only — no instructor code alongside it
    expect(options).toEqual(['All', 'David Kim', 'Sarah Jenkins'])
  })

  it('skips a cohort whose reference lookup fails, keeping instructors resolved from the others', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([
      cohort({ id: 'c1', lifecycleState: 'STOOD_UP' }),
      cohort({ id: 'c2', lifecycleState: 'STOOD_UP' }),
    ])
    vi.mocked(cohortsSvc.getCohortReference).mockImplementation(async (cohortId: string) =>
      cohortId === 'c1' ? Promise.reject(new Error('boom')) : reference(),
    )
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [], totalElements: 0 }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    const instructorSelect = wrapper.findAll('.fld').find((f) => f.text().includes('Instructor'))!.find('select')
    expect(instructorSelect.findAll('option').map((o) => o.text())).toEqual(['All', 'Sarah Jenkins'])
  })

  it('re-fetches runs (but not events\' unrelated fields) with the chosen instructorContactId', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [], totalElements: 0 }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    const instructorSelect = wrapper.findAll('.fld').find((f) => f.text().includes('Instructor'))!.find('select')
    await instructorSelect.setValue('ins-1')
    await flushPromises()

    expect(auditSvc.listAuditRuns).toHaveBeenLastCalledWith(expect.objectContaining({ instructorContactId: 'ins-1' }))
  })

  it('renders lifecycle events on the events tab, falling back to the cohorts store for the cohort name', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [], totalElements: 0 }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [event({ cohortId: 'c1' })] }))

    const wrapper = mountView()
    await flushPromises()
    await goToEventsTab(wrapper)

    expect(wrapper.text()).toContain('STOOD UP')
    expect(wrapper.text()).toContain('admin@amalitech.com')
    expect(wrapper.text()).toContain('Cohort 7')
  })

  it('shows the total event count on the tab badge, not just the current page size', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [], totalElements: 0 }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ totalElements: 47, totalPages: 3, last: false }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Lifecycle events')
    expect(wrapper.text()).toContain('47')
  })

  it('paginates events via the Next button without re-fetching runs', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage())
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ last: false, totalPages: 2, totalElements: 21 }))

    const wrapper = mountView()
    await flushPromises()
    await goToEventsTab(wrapper)

    const runsCallCount = vi.mocked(auditSvc.listAuditRuns).mock.calls.length

    await wrapper.find('button[aria-label="Next page"]').trigger('click')
    await flushPromises()

    expect(auditSvc.listAuditEvents).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(auditSvc.listAuditRuns).toHaveBeenCalledTimes(runsCallCount)
  })

  it('navigates to the event detail page when an event row is clicked', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [], totalElements: 0 }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [event({ id: 'ev-42' })] }))

    const wrapper = mountView()
    await flushPromises()
    await goToEventsTab(wrapper)

    await wrapper.find('tbody tr.row-click').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('admin-audit-event')
    expect(router.currentRoute.value.params.id).toBe('ev-42')
  })

  it('opens the initial tab from the ?tab query param, so returning from a detail page lands back on Events', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [], totalElements: 0 }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage())

    await router.push({ name: 'admin-audit', query: { tab: 'events' } })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[role="tab"][aria-selected="true"]').text()).toContain('Lifecycle events')
  })

  it('shows the total run count on the tab badge, not just the current page size', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ totalElements: 32, totalPages: 2, last: false }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Ingestion runs')
    expect(wrapper.text()).toContain('32')
  })

  it('paginates runs via the Next button, now that /audit-log/ingestion-runs is genuinely cross-cohort paginated', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ last: false, totalPages: 2, totalElements: 21 }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button[aria-label="Next page"]').trigger('click')
    await flushPromises()

    expect(auditSvc.listAuditRuns).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
  })

  it('flags a high-failure run in the expanded detail row', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({
      content: [run({ highFailure: true, failureRatePercent: 63.2 })],
    }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('tbody tr.row-click').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('High failure')
    expect(wrapper.text()).toContain('63.2%')
  })

  it('re-fetches events with the chosen event type', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue(runsPage({ content: [], totalElements: 0 }))
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage())

    const wrapper = mountView()
    await flushPromises()
    await goToEventsTab(wrapper)

    const eventTypeSelect = wrapper.findAll('.fld').find((f) => f.text().includes('Event type'))!.find('select')
    await eventTypeSelect.setValue('COHORT_LOCKED')
    await flushPromises()

    expect(auditSvc.listAuditEvents).toHaveBeenLastCalledWith(expect.objectContaining({ eventType: 'COHORT_LOCKED' }))
  })
})
