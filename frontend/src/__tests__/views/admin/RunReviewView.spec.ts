import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia } from 'pinia'
import RunReviewView from '@/views/admin/RunReviewView.vue'
import type { IngestionRun } from '@/types/run.types'
import type { IngestionConflictResponse, RunReview } from '@/types/runReview.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/runReview.service', () => ({
  getRunReview: vi.fn<() => Promise<unknown>>(),
  listConflicts: vi.fn<() => Promise<unknown>>(),
  resolveConflict: vi.fn<() => Promise<unknown>>(),
  dismissConflict: vi.fn<() => Promise<unknown>>(),
  sendNotification: vi.fn<() => Promise<unknown>>(),
  sendAllNotifications: vi.fn<() => Promise<unknown>>(),
  dismissNotification: vi.fn<() => Promise<unknown>>(),
}))
// The review panels only render once the sync-run stream reports sync.done
// (store.fetchReview is invoked from that callback, not unconditionally on
// mount) — so runs.service.getRun has to report the job as still RUNNING/
// processing, and the stream then has to be driven to completion.
vi.mock('@/services/runs.service', () => ({
  getRun: vi.fn<() => Promise<unknown>>(),
  listRuns: vi.fn<() => Promise<unknown>>(),
  triggerSync: vi.fn<() => Promise<unknown>>(),
  triggerSyncAll: vi.fn<() => Promise<unknown>>(),
  syncRunStreamUrl: vi.fn<() => string>(() => 'http://mock/stream'),
}))
// useSyncRunStream branches on USE_MOCKS (true by default without a local
// .env.local override, e.g. in CI) — force the real EventSource branch so
// this test is deterministic regardless of where it runs.
vi.mock('@/services/mock/useMocks', () => ({
  USE_MOCKS: false,
}))
import * as reviewSvc from '@/services/runReview.service'
import * as runsSvc from '@/services/runs.service'

const processingRun: IngestionRun = {
  id: 'run-1', cohortId: 'c1', cohortName: 'Cohort 7', status: 'processing', runAt: '2026-07-21T08:00:00Z',
}

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
    conflicts: [],
    notifications: [{
      id: 'nt-1', ingestionRunId: 'run-1', cohortId: 'c1', type: 'instructor_digest',
      recipientKind: 'instructor', recipientName: 'Sarah', recipientEmail: 's@x.com',
      dispatchPolicy: 'HELD', status: 'PENDING',
    }],
  }
}

function conflictsPage(overrides: Partial<Paged<IngestionConflictResponse>> = {}): Paged<IngestionConflictResponse> {
  return {
    content: [{
      id: 'cf-1', ingestionRunId: 'run-1', cohortId: 'c1', learnerId: 'DEG-1', labId: 'lab-1',
      conflictKind: 'in_file_duplicate', existingResultId: null,
      incomingPayload: { score: [90, 85] },
      status: 'PENDING', resolvedBy: null, resolvedAt: null, resolutionNote: null,
      createdAt: '2026-07-21T08:01:00Z', updatedAt: '2026-07-21T08:01:00Z',
    }],
    number: 0, size: 20, totalElements: 1, totalPages: 1, last: true,
    ...overrides,
  }
}

class FakeEventSource {
  listeners = new Map<string, ((e: MessageEvent) => void)[]>()
  onerror: (() => void) | null = null
  constructor(public url: string) {
    FakeEventSource.instances.push(this)
  }
  addEventListener(name: string, cb: (e: MessageEvent) => void) {
    const list = this.listeners.get(name) ?? []
    list.push(cb)
    this.listeners.set(name, list)
  }
  emit(name: string, data: unknown) {
    for (const cb of this.listeners.get(name) ?? []) cb({ data: JSON.stringify(data) } as MessageEvent)
  }
  close() {}
  static instances: FakeEventSource[] = []
}

let router: Router
beforeEach(async () => {
  vi.clearAllMocks()
  FakeEventSource.instances = []
  vi.stubGlobal('EventSource', FakeEventSource)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/runs', name: 'admin-runs', component: { template: '<div/>' } },
      { path: '/admin/runs/:id', name: 'admin-run-review', component: { template: '<div/>' } },
    ],
  })
  router.push({ name: 'admin-run-review', params: { id: 'run-1' }, query: { cohortId: 'c1' } })
  await router.isReady()
})
afterEach(() => vi.restoreAllMocks())

function mountView() {
  return mount(RunReviewView, { global: { plugins: [createPinia(), router] } })
}

/** Drives the sync-run stream to completion so `store.fetchReview` (fired from its onDone) actually runs. */
async function completeSync() {
  const es = FakeEventSource.instances[0]!
  es.emit('sync.done', { cohortName: 'Cohort 7', filesSeen: 1, new: 0, changed: 1, unchanged: 0, failed: 0, status: 'COMPLETED' })
  await flushPromises()
}

describe('RunReviewView', () => {
  it('renders the three panels once the sync stream completes', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Syncing grading data')

    await completeSync()

    const text = wrapper.text()
    expect(text).toContain('Results')
    expect(text).toContain('Conflict queue')
    expect(text).toContain('Notifications')
    expect(text).toContain('High failure rate')
    expect(text).toContain('DEG-1')
  })

  it('fetches conflicts for the run and paginates via the Next button', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage({ last: false, totalPages: 2 }))
    const wrapper = mountView()
    await flushPromises()
    await completeSync()

    expect(reviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'run-1', { status: undefined, page: 0, size: 20 })

    await wrapper.findAll('button').find((b) => b.text() === 'Next')!.trigger('click')
    await flushPromises()
    expect(reviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'run-1', { status: undefined, page: 1, size: 20 })
  })

  it('re-fetches conflicts when the status filter changes', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    const wrapper = mountView()
    await flushPromises()
    await completeSync()

    await wrapper.find('select').setValue('RESOLVED')
    await flushPromises()
    expect(reviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'run-1', { status: 'RESOLVED', page: 0, size: 20 })
  })

  it('resolves a pending conflict via the Keep incoming button', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.resolveConflict).mockResolvedValue({
      ...conflictsPage().content[0]!,
      status: 'RESOLVED',
      resolutionNote: null,
    })
    const wrapper = mountView()
    await flushPromises()
    await completeSync()

    await wrapper.findAll('button').find((b) => b.text() === 'Keep incoming')!.trigger('click')
    await flushPromises()

    expect(reviewSvc.resolveConflict).toHaveBeenCalledWith('c1', 'cf-1', { action: 'KEEP_INCOMING' })
    expect(wrapper.text()).toContain('RESOLVED')
  })

  it('hides the Keep existing button when there is no existing result to keep', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    const wrapper = mountView()
    await flushPromises()
    await completeSync()

    expect(wrapper.findAll('button').some((b) => b.text() === 'Keep existing')).toBe(false)
  })

  it('send-all dispatches held notifications', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.sendAllNotifications).mockResolvedValue([{ ...review().notifications[0]!, status: 'SENT' }])
    const wrapper = mountView()
    await flushPromises()
    await completeSync()
    await wrapper.findAll('button').find((b) => b.text().includes('Send all held'))!.trigger('click')
    await flushPromises()
    expect(reviewSvc.sendAllNotifications).toHaveBeenCalledWith('run-1')
  })
})
