import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia } from 'pinia'
import AuditEventDetailView from '@/views/admin/AuditEventDetailView.vue'
import type { Cohort } from '@/types/domain.types'
import type { AuditEvent } from '@/types/audit.types'

vi.mock('@/services/audit.service', () => ({
  listAuditRuns: vi.fn<() => Promise<unknown>>(),
  listAuditEvents: vi.fn<() => Promise<unknown>>(),
  getAuditEvent: vi.fn<() => Promise<unknown>>(),
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

function event(over: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'ev-42', eventType: 'GATE_FAILED', cohortId: 'c1', actorEmail: 'admin@amalitech.com',
    occurredAt: '2026-07-20T08:00:00Z', payload: { rule: 'F1-BLANK-TOTAL-SCORE', row: 12 },
    ...over,
  }
}

let router: Router
beforeEach(async () => {
  vi.clearAllMocks()
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/audit', name: 'admin-audit', component: { template: '<div/>' } },
      { path: '/admin/audit/events/:id', name: 'admin-audit-event', component: { template: '<div/>' } },
    ],
  })
  router.push({ name: 'admin-audit-event', params: { id: 'ev-42' } })
  await router.isReady()
})

function mountView() {
  return mount(AuditEventDetailView, { global: { plugins: [createPinia(), router] } })
}

describe('AuditEventDetailView', () => {
  it('fetches the event by id from the route param and renders its fields', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.getAuditEvent).mockResolvedValue(event())

    const wrapper = mountView()
    await flushPromises()

    expect(auditSvc.getAuditEvent).toHaveBeenCalledWith('ev-42')
    expect(wrapper.text()).toContain('GATE FAILED')
    expect(wrapper.text()).toContain('Cohort 7')
    expect(wrapper.text()).toContain('admin@amalitech.com')
  })

  it('renders the payload as field/value rows', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.getAuditEvent).mockResolvedValue(event({ payload: { rule: 'F1-BLANK-TOTAL-SCORE', row: 12 } }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('rule')
    expect(wrapper.text()).toContain('F1-BLANK-TOTAL-SCORE')
    expect(wrapper.text()).toContain('row')
    expect(wrapper.text()).toContain('12')
  })

  it('renders a GATE_PASSED payload with mixed value types cleanly (boolean, null, array, nested object)', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.getAuditEvent).mockResolvedValue(
      event({
        eventType: 'GATE_PASSED',
        payload: {
          gate: 4,
          quizReferencePresent: true,
          discardedPreviousAttempt: false,
          skippedNote: null,
          checkedFiles: ['a.xlsx', 'b.xlsx'],
          criteria: { specs: 3, modules: 9 },
        },
      }),
    )

    const wrapper = mountView()
    await flushPromises()
    const text = wrapper.text()

    // booleans read as Yes/No, not the raw words "true"/"false"
    expect(text).toContain('Yes')
    expect(text).toContain('No')
    // null renders as a dash, not the literal word "null"
    expect(text).not.toContain('null')
    expect(text).toContain('—')
    // primitive-only array is a readable comma list
    expect(text).toContain('a.xlsx, b.xlsx')
    // nested object is pretty-printed JSON, not squashed into "[object Object]"
    expect(text).not.toContain('[object Object]')
    expect(text).toContain('"specs": 3')
  })

  it('renders a CONFLICT_RESOLVED payload with a humanized action, matching CohortSyncService.resolveConflict\'s minimal { conflictId, action, note } shape', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.getAuditEvent).mockResolvedValue(
      event({
        eventType: 'CONFLICT_RESOLVED',
        payload: { conflictId: 'cf-002', action: 'KEEP_INCOMING', note: 'Kept row 41 (later submission).' },
      }),
    )

    const wrapper = mountView()
    await flushPromises()
    const text = wrapper.text()

    expect(text).toContain('CONFLICT RESOLVED')
    // SCREAMING_SNAKE_CASE action reads as a title-cased phrase, not the raw code
    expect(text).toContain('Keep Incoming')
    expect(text).not.toContain('KEEP_INCOMING')
    // the id has no underscores and stays untouched; the note is prose and passes through as-is
    expect(text).toContain('cf-002')
    expect(text).toContain('Kept row 41 (later submission).')
  })

  it('renders a CONFLICT_DISMISSED payload (the REJECT-action counterpart to CONFLICT_RESOLVED)', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.getAuditEvent).mockResolvedValue(
      event({
        eventType: 'CONFLICT_DISMISSED',
        payload: { conflictId: 'cf-003', action: 'REJECT', note: 'Duplicate export from instructor — no action needed.' },
      }),
    )

    const wrapper = mountView()
    await flushPromises()
    const text = wrapper.text()

    expect(text).toContain('CONFLICT DISMISSED')
    expect(text).toContain('cf-003')
  })

  it('shows a friendly message when there is no payload', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.getAuditEvent).mockResolvedValue(event({ payload: undefined }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('No additional payload')
  })

  it('shows SYSTEM for a null actor and falls back to the raw cohort id if the cohort is unknown', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([])
    vi.mocked(auditSvc.getAuditEvent).mockResolvedValue(event({ actorEmail: null, cohortId: 'unknown-cohort' }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('SYSTEM')
    expect(wrapper.text()).toContain('unknown-cohort')
  })

  it('surfaces a load error', async () => {
    vi.mocked(cohortsSvc.listCohorts).mockResolvedValue([cohort()])
    vi.mocked(auditSvc.getAuditEvent).mockRejectedValue(new Error('Event not found'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Event not found')
  })
})
