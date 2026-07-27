import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia } from 'pinia'
import RunReviewView from '@/views/admin/RunReviewView.vue'
import type { IngestionRun } from '@/types/run.types'
import type { RunReview } from '@/types/runReview.types'

vi.mock('@/services/runReview.service', () => ({
  getRunReview: vi.fn<() => Promise<unknown>>(),
  resolveConflict: vi.fn<() => Promise<unknown>>(),
  dismissConflict: vi.fn<() => Promise<unknown>>(),
  sendNotification: vi.fn<() => Promise<unknown>>(),
  sendAllNotifications: vi.fn<() => Promise<unknown>>(),
  dismissNotification: vi.fn<() => Promise<unknown>>(),
}))
import * as svc from '@/services/runReview.service'

const run: IngestionRun = {
  id: 'run-1', cohortId: 'c1', cohortName: 'Cohort 7', workbookFilename: 'FE.xlsx',
  sharepointFileUrl: null, sharepointVersionId: '5.0', quickXorHash: 'h',
  triggeredByEmail: null, triggerType: 'SCHEDULED', status: 'partial',
  counts: { rowsRead: 30, committedNew: 12, updated: 2, skippedInvalid: 14, skippedUnchanged: 0, conflicts: 1 },
  highFailure: true, runAt: '2026-07-21T08:00:00Z', errorReport: [],
}

function review(): RunReview {
  return {
    run,
    conflicts: [{
      id: 'cf-1', ingestionRunId: 'run-1', cohortId: 'c1', learnerId: 'DEG-1', labId: 'lab-1',
      conflictKind: 'in_file_duplicate', existingResult: null,
      incomingRows: [
        { learnerId: 'DEG-1', labTitle: 'Lab 2', score: 90, submittedOn: '2026-07-19', sourceRef: 'r12' },
        { learnerId: 'DEG-1', labTitle: 'Lab 2', score: 85, submittedOn: '2026-07-19', sourceRef: 'r21' },
      ],
      status: 'PENDING',
    }],
    notifications: [{
      id: 'nt-1', ingestionRunId: 'run-1', cohortId: 'c1', type: 'instructor_digest',
      recipientKind: 'instructor', recipientName: 'Sarah', recipientEmail: 's@x.com',
      dispatchPolicy: 'HELD', status: 'PENDING',
    }],
  }
}

let router: Router
beforeEach(async () => {
  vi.clearAllMocks()
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/runs', name: 'admin-runs', component: { template: '<div/>' } },
      { path: '/admin/runs/:id', name: 'admin-run-review', component: { template: '<div/>' } },
    ],
  })
  router.push({ name: 'admin-run-review', params: { id: 'run-1' } })
  await router.isReady()
})
afterEach(() => vi.restoreAllMocks())

function mountView() {
  return mount(RunReviewView, { global: { plugins: [createPinia(), router] } })
}

describe('RunReviewView', () => {
  it('renders the three panels from the loaded review', async () => {
    vi.mocked(svc.getRunReview).mockResolvedValue(review())
    const wrapper = mountView()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Results')
    expect(text).toContain('Conflict queue')
    expect(text).toContain('Notifications')
    expect(text).toContain('High failure rate')
    expect(text).toContain('DEG-1')
  })

  it('resolving a conflict calls the service with the chosen row', async () => {
    vi.mocked(svc.getRunReview).mockResolvedValue(review())
    vi.mocked(svc.resolveConflict).mockResolvedValue({ ...review().conflicts[0]!, status: 'RESOLVED' })
    const wrapper = mountView()
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text() === 'Use this')!.trigger('click')
    await flushPromises()
    expect(svc.resolveConflict).toHaveBeenCalledWith('cf-1', { chosenRowIndex: 0 })
  })

  it('send-all dispatches held notifications', async () => {
    vi.mocked(svc.getRunReview).mockResolvedValue(review())
    vi.mocked(svc.sendAllNotifications).mockResolvedValue([{ ...review().notifications[0]!, status: 'SENT' }])
    const wrapper = mountView()
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text().includes('Send all held'))!.trigger('click')
    await flushPromises()
    expect(svc.sendAllNotifications).toHaveBeenCalledWith('run-1')
  })
})
