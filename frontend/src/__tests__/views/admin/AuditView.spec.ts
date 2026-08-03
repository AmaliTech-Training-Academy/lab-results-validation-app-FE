import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia } from 'pinia'
import AuditView from '@/views/admin/AuditView.vue'
import type { IngestionRun } from '@/types/run.types'
import type { Cohort } from '@/types/domain.types'
import type { AuditEvent } from '@/types/audit.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/audit.service', () => ({
  listAuditRuns: vi.fn<() => Promise<unknown>>(),
  listAuditEvents: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/cohorts.service', () => ({
  listCohorts: vi.fn<() => Promise<unknown>>(),
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

function run(over: Partial<IngestionRun> = {}): IngestionRun {
  return { id: 'run-1', cohortId: 'c1', status: 'completed', runAt: '2026-07-20T08:00:00Z', ...over }
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
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue([run({ cohortName: undefined })])
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Cohort 7')
  })

  it('re-fetches both tabs with the chosen cohortId when the cohort filter changes', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue([])
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ content: [] }))

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('select').setValue('c1')
    await flushPromises()

    expect(auditSvc.listAuditRuns).toHaveBeenLastCalledWith(expect.objectContaining({ cohortId: 'c1' }))
    expect(auditSvc.listAuditEvents).toHaveBeenLastCalledWith(expect.objectContaining({ cohortId: 'c1' }))
  })

  it('renders lifecycle events on the events tab, falling back to the cohorts store for the cohort name', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue([])
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
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue([])
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ totalElements: 47, totalPages: 3, last: false }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Lifecycle events')
    expect(wrapper.text()).toContain('47')
  })

  it('paginates events via the Next button without re-fetching runs', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue([run()])
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage({ last: false, totalPages: 2 }))

    const wrapper = mountView()
    await flushPromises()
    await goToEventsTab(wrapper)

    const runsCallCount = vi.mocked(auditSvc.listAuditRuns).mock.calls.length

    await wrapper.findAll('button').find((b) => b.text() === 'Next')!.trigger('click')
    await flushPromises()

    expect(auditSvc.listAuditEvents).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    expect(auditSvc.listAuditRuns).toHaveBeenCalledTimes(runsCallCount)
  })

  it('navigates to the event detail page when an event row is clicked', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue([])
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
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue([])
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage())

    await router.push({ name: 'admin-audit', query: { tab: 'events' } })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[role="tab"][aria-selected="true"]').text()).toContain('Lifecycle events')
  })

  it('re-fetches events with the chosen event type', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.listAuditRuns).mockResolvedValue([])
    vi.mocked(auditSvc.listAuditEvents).mockResolvedValue(eventsPage())

    const wrapper = mountView()
    await flushPromises()
    await goToEventsTab(wrapper)

    const selects = wrapper.findAll('select')
    const eventTypeSelect = selects[2]!
    await eventTypeSelect.setValue('COHORT_LOCKED')
    await flushPromises()

    expect(auditSvc.listAuditEvents).toHaveBeenLastCalledWith(expect.objectContaining({ eventType: 'COHORT_LOCKED' }))
  })
})
