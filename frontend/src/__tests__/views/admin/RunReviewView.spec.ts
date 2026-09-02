import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import RunReviewView from '@/views/admin/RunReviewView.vue'
import { useToastStore } from '@/stores/toast'
import type { IngestionRun } from '@/types/run.types'
import type { IngestionConflictResponse, Notification, RunReview } from '@/types/runReview.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/runReview.service', () => ({
  getRunReview: vi.fn<() => Promise<unknown>>(),
  listConflicts: vi.fn<() => Promise<unknown>>(),
  listNotifications: vi.fn<() => Promise<unknown>>(),
  resolveConflict: vi.fn<() => Promise<unknown>>(),
  dismissConflict: vi.fn<() => Promise<unknown>>(),
  sendNotification: vi.fn<() => Promise<unknown>>(),
  sendAllNotifications: vi.fn<() => Promise<unknown>>(),
  dismissNotification: vi.fn<() => Promise<unknown>>(),
  notificationStreamUrl: vi.fn<() => string>(() => 'http://mock/notifications-stream'),
  // The stream carries the same shape `listNotifications` already returns mapped+enriched, so the test
  // fixtures below can be emitted as-is without a separate raw-DTO shape.
  mapStreamNotification: vi.fn<(n: unknown) => Promise<unknown>>(async (n) => n),
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

function review(over: Partial<RunReview> = {}): RunReview {
  return { run, conflicts: [], notifications: [], ...over }
}

function conflictRow(over: Partial<IngestionConflictResponse> = {}): IngestionConflictResponse {
  return {
    id: 'cf-1', ingestionRunId: 'run-1', cohortId: 'c1', learnerId: 'DEG-1', learnerName: 'Ama Boateng',
    labId: 'lab-1', labTitle: 'FE State Management',
    conflictKind: 'in_file_duplicate', existingResultId: null, existingResult: null,
    candidates: [
      { index: 0, fileName: 'FEM01.xlsx', sheetName: 'FEM01', rowNum: 12, nspName: 'Ama Boateng', score: 90, submittedOn: '2026-07-19', instructorContactId: 'ins-1', reviewerName: 'Kwame Asante', payloadIntact: true },
    ],
    incomingPayload: { score: [90] },
    remediation: 'Duplicate row for Ama Boateng / FE State Management — sheet FEM01, row 12.',
    status: 'PENDING', resolvedBy: null, resolvedAt: null, resolutionNote: null,
    createdAt: '2026-07-21T08:01:00Z', updatedAt: '2026-07-21T08:01:00Z',
    ...over,
  }
}

function conflictsPage(overrides: Partial<Paged<IngestionConflictResponse>> = {}): Paged<IngestionConflictResponse> {
  return {
    content: [conflictRow()],
    number: 0, size: 20, totalElements: 1, totalPages: 1, last: true,
    ...overrides,
  }
}

function notification(over: Partial<Notification> = {}): Notification {
  return {
    id: 'nt-1', ingestionRunId: 'run-1', cohortId: 'c1', syncJobId: 'run-1', type: 'instructor_digest',
    recipientKind: 'instructor', recipientName: 'Sarah', recipientEmail: 's@x.com',
    dispatchPolicy: 'HELD', status: 'PENDING', issues: [], createdAt: '2026-07-21T08:01:00Z',
    ...over,
  }
}

function notificationsPage(overrides: Partial<Paged<Notification>> = {}): Paged<Notification> {
  return { content: [notification()], number: 0, size: 20, totalElements: 1, totalPages: 1, last: true, ...overrides }
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
let activeWrapper: ReturnType<typeof mount> | null = null
afterEach(() => {
  // Teleport (kebab popovers, the conflict resolution drawer) renders into document.body, outside
  // the wrapper's own element — if left mounted, its DOM (and live event handlers) leak into the
  // next test. Unmount explicitly rather than relying on each test to close what it opened.
  activeWrapper?.unmount()
  activeWrapper = null
  vi.restoreAllMocks()
})

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(RunReviewView, { global: { plugins: [pinia, router] } })
  activeWrapper = wrapper
  return { wrapper, pinia }
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
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Syncing grading data')

    await completeSync()

    const text = wrapper.text()
    expect(text).toContain('Results')
    expect(text).toContain('Conflict queue')
    expect(text).toContain('Notifications')
    expect(text).toContain('High failure rate')
    expect(text).toContain('Ama Boateng')
    expect(text).toContain('Sarah')
  })

  it('keeps a folder.failed error visible after sync.done instead of dropping it once the stream stops polling', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()

    const es = FakeEventSource.instances[0]!
    es.emit('folder.failed', { folder: 'Scenario 2', error: 'Cannot list contents of the SharePoint folder.' })
    await flushPromises()
    expect(wrapper.text()).toContain('Scenario 2 — Cannot list contents of the SharePoint folder.')

    // sync.done stops the stream (isPolling flips false) and the view moves on to the loaded
    // Results panel — the folder error must still be visible, not silently dropped.
    await completeSync()

    expect(wrapper.text()).toContain('Results')
    expect(wrapper.text()).toContain('Scenario 2 — Cannot list contents of the SharePoint folder.')
  })

  it('shows a retry state when the review fails to load, and reloads on Try again', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockRejectedValueOnce(new Error('Network error'))
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    expect(wrapper.text()).toContain('Could not load this run')
    expect(wrapper.text()).toContain('Network error')

    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    const tryAgain = wrapper.findAll('button').find((b) => b.text() === 'Try again')
    await tryAgain!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Results')
    expect(wrapper.text()).toContain('Conflict queue')
  })

  it('fetches conflicts for the run and paginates via the Next button', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    // totalElements > one page's worth (VTablePager derives its own page count from total/pageSize,
    // unlike the old hand-rolled pager which trusted the server's `last`/`totalPages` fields directly).
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage({ last: false, totalPages: 2, totalElements: 21 }))
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    expect(reviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'run-1', { status: undefined, page: 0, size: 10 })

    const conflictsNext = wrapper.findAll('[aria-label="Next page"]').find((b) => b.attributes('disabled') === undefined)
    await conflictsNext!.trigger('click')
    await flushPromises()
    expect(reviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'run-1', { status: undefined, page: 1, size: 10 })
  })

  it('changes the conflicts page size and refetches exactly once, at a recalculated page, with the new size', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage({ last: false, totalPages: 3, totalElements: 21 }))
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()
    vi.mocked(reviewSvc.listConflicts).mockClear()

    // VTablePager's size <select> always fires update:pageSize immediately followed by update:page —
    // picking a new size must resolve to exactly one refetch carrying that size, not a stray/garbled
    // page jump computed against the old size (the bug: the page-jump fired even though nothing
    // applied the new size, since the view never listened for update:pageSize at all).
    const sizeSelect = wrapper.findAll('select[aria-label="Rows per page"]')[0]!
    await sizeSelect.setValue('25')
    await flushPromises()

    expect(reviewSvc.listConflicts).toHaveBeenCalledTimes(1)
    expect(reviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'run-1', { status: undefined, page: 0, size: 25 })
  })

  it('keeps the conflicts pager visible (disabled, not unmounted behind a full skeleton) while a page change is in flight', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage({ last: false, totalPages: 2, totalElements: 21 }))
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    let resolveNext!: (value: Paged<IngestionConflictResponse>) => void
    vi.mocked(reviewSvc.listConflicts).mockReturnValue(new Promise((resolve) => { resolveNext = resolve }))
    const conflictsNext = wrapper.findAll('[aria-label="Next page"]').find((b) => b.attributes('disabled') === undefined)
    await conflictsNext!.trigger('click')
    await flushPromises()

    // The click must not swap the whole table+pager out for a loading skeleton — the pager the admin
    // just clicked should still be right there, just disabled until the new page lands.
    expect(wrapper.find('[aria-label="Next page"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Next page"]').attributes('disabled')).toBeDefined()

    resolveNext(conflictsPage({ number: 1, last: false, totalPages: 2, totalElements: 21 }))
    await flushPromises()
    expect(wrapper.find('[aria-label="Next page"]').attributes('disabled')).toBeUndefined()
  })

  it('re-fetches conflicts when the status filter changes', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    await wrapper.find('select').setValue('RESOLVED')
    await flushPromises()
    expect(reviewSvc.listConflicts).toHaveBeenCalledWith('c1', 'run-1', { status: 'RESOLVED', page: 0, size: 10 })
  })

  it('resolves a pending conflict via the Keep incoming button', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    vi.mocked(reviewSvc.resolveConflict).mockResolvedValue({
      ...conflictsPage().content[0]!,
      status: 'RESOLVED',
      resolutionNote: null,
    })
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    // "Review" opens the resolution drawer, which teleports to <body>.
    const reviewBtn = wrapper.findAll('button').find((b) => b.text() === 'Review')
    await reviewBtn!.trigger('click')
    await flushPromises()
    const candidateCard = Array.from(document.body.querySelectorAll('.compare-card')).find((el) => el.textContent?.includes('90'))
    ;(candidateCard as HTMLElement).click()
    await flushPromises()
    const keepBtn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Keep selected')
    keepBtn!.click()
    await flushPromises()

    expect(reviewSvc.resolveConflict).toHaveBeenCalledWith('c1', 'cf-1', { action: 'KEEP_INCOMING', chosenRowIndex: 0 })
    expect(wrapper.text()).toContain('RESOLVED')
  })

  it('disables picking the existing row in the drawer when there is no existing result to keep', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    const reviewBtn = wrapper.findAll('button').find((b) => b.text() === 'Review')
    await reviewBtn!.trigger('click')
    await flushPromises()
    const cards = document.body.querySelectorAll('.compare-card')
    expect(cards[0]?.textContent).toContain('Existing')
    expect(cards[0]?.hasAttribute('disabled')).toBe(true)
    expect(cards[1]?.hasAttribute('disabled')).toBe(false)
  })

  it('shows the trainee name, lab title and both marks for a duplicate with two candidates, not raw ids/JSON', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage({
      content: [conflictRow({
        candidates: [
          { index: 0, fileName: 'FEM01.xlsx', sheetName: 'FEM01', rowNum: 12, nspName: 'Ama Boateng', score: 90, submittedOn: '2026-07-19', instructorContactId: 'ins-1', reviewerName: 'Kwame Asante', payloadIntact: true },
          { index: 1, fileName: 'FEM01.xlsx', sheetName: 'FEM01', rowNum: 21, nspName: 'Ama Boateng', score: 85, submittedOn: '2026-07-19', instructorContactId: 'ins-1', reviewerName: 'Kwame Asante', payloadIntact: true },
        ],
      })],
    }))
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    // Names, not raw ids — and both marks are visible right in the collapsed row, not just after a click.
    expect(wrapper.text()).toContain('Ama Boateng')
    expect(wrapper.text()).toContain('FE State Management')
    expect(wrapper.text()).not.toContain('DEG-1')
    expect(wrapper.text()).toContain('90')
    expect(wrapper.text()).toContain('85')

    // Full location detail lives in the resolution drawer.
    const reviewBtn = wrapper.findAll('button').find((b) => b.text() === 'Review')
    await reviewBtn!.trigger('click')
    await flushPromises()
    const bodyText = document.body.textContent ?? ''
    expect(bodyText).toContain('sheet FEM01 row 12')
    expect(bodyText).toContain('sheet FEM01 row 21')
  })

  it('resolves KEEP_INCOMING with the chosen candidate index when a conflict has more than one candidate', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage({
      content: [conflictRow({
        candidates: [
          { index: 0, fileName: 'FEM01.xlsx', sheetName: 'FEM01', rowNum: 12, nspName: 'Ama Boateng', score: 90, submittedOn: '2026-07-19', instructorContactId: 'ins-1', reviewerName: 'Kwame Asante', payloadIntact: true },
          { index: 1, fileName: 'FEM01.xlsx', sheetName: 'FEM01', rowNum: 21, nspName: 'Ama Boateng', score: 85, submittedOn: '2026-07-19', instructorContactId: 'ins-1', reviewerName: 'Kwame Asante', payloadIntact: true },
        ],
      })],
    }))
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    vi.mocked(reviewSvc.resolveConflict).mockResolvedValue({ ...conflictsPage().content[0]!, status: 'RESOLVED' })
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    const reviewBtn = wrapper.findAll('button').find((b) => b.text() === 'Review')
    await reviewBtn!.trigger('click')
    await flushPromises()

    // Pick the second candidate (row 21, score 85) — not the first — to prove the index actually threads through.
    const candidateCard = Array.from(document.body.querySelectorAll('.compare-card')).find((el) => el.textContent?.includes('row 21'))
    ;(candidateCard as HTMLElement).click()
    await flushPromises()
    const keepBtn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Keep selected')
    keepBtn!.click()
    await flushPromises()

    expect(reviewSvc.resolveConflict).toHaveBeenCalledWith('c1', 'cf-1', { action: 'KEEP_INCOMING', chosenRowIndex: 1 })
  })

  it('sends an optional resolution note along with the decision', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    vi.mocked(reviewSvc.resolveConflict).mockResolvedValue({ ...conflictsPage().content[0]!, status: 'RESOLVED', resolutionNote: 'Later submission is correct' })
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    const reviewBtn = wrapper.findAll('button').find((b) => b.text() === 'Review')
    await reviewBtn!.trigger('click')
    await flushPromises()
    ;(document.body.querySelector('.compare-card:not(:disabled)') as HTMLElement).click()
    const textarea = document.body.querySelector('textarea') as HTMLTextAreaElement
    textarea.value = 'Later submission is correct'
    textarea.dispatchEvent(new Event('input'))
    await flushPromises()
    const keepBtn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Keep selected')
    keepBtn!.click()
    await flushPromises()

    expect(reviewSvc.resolveConflict).toHaveBeenCalledWith('c1', 'cf-1', { action: 'KEEP_INCOMING', chosenRowIndex: 0, note: 'Later submission is correct' })
  })

  it('rejects both rows from the resolution drawer', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    vi.mocked(reviewSvc.resolveConflict).mockResolvedValue({ ...conflictsPage().content[0]!, status: 'DISMISSED' })
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    const reviewBtn = wrapper.findAll('button').find((b) => b.text() === 'Review')
    await reviewBtn!.trigger('click')
    await flushPromises()
    // "Reject both" opens a confirmation modal first — it doesn't fire the resolve call by itself.
    const rejectBtn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Reject both')
    rejectBtn!.click()
    await flushPromises()
    expect(reviewSvc.resolveConflict).not.toHaveBeenCalled()

    const confirmBtn = Array.from(document.body.querySelector('.modal-foot')!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Reject both')
    confirmBtn!.click()
    await flushPromises()

    expect(reviewSvc.resolveConflict).toHaveBeenCalledWith('c1', 'cf-1', { action: 'REJECT' })
    expect(wrapper.text()).toContain('DISMISSED')
  })

  it('shows the backend error inline in the drawer and keeps it open when resolving fails', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    vi.mocked(reviewSvc.resolveConflict).mockRejectedValue(new Error('Conflict was already resolved by another admin'))
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    const reviewBtn = wrapper.findAll('button').find((b) => b.text() === 'Review')
    await reviewBtn!.trigger('click')
    await flushPromises()
    ;(document.body.querySelector('.compare-card:not(:disabled)') as HTMLElement).click()
    await flushPromises()
    const keepBtn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Keep selected')
    keepBtn!.click()
    await flushPromises()

    expect(document.body.textContent).toContain('Conflict was already resolved by another admin')
  })

  it('fetches notifications for the run and paginates via the Next button', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    // totalElements > one page's worth (VTablePager derives its own page count from total/pageSize,
    // unlike the old hand-rolled pager which trusted the server's `last`/`totalPages` fields directly).
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage({ last: false, totalPages: 2, totalElements: 21 }))
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    expect(reviewSvc.listNotifications).toHaveBeenCalledWith({ cohortId: 'c1', syncJobId: 'run-1', status: undefined, page: 0, size: 10 })

    const notificationsNext = wrapper.findAll('[aria-label="Next page"]').find((b) => b.attributes('disabled') === undefined)
    await notificationsNext!.trigger('click')
    await flushPromises()
    expect(reviewSvc.listNotifications).toHaveBeenCalledWith({ cohortId: 'c1', syncJobId: 'run-1', status: undefined, page: 1, size: 10 })
  })

  it('surfaces per-notification issues in a details drill-down', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage({
      content: [notification({
        issues: [{ location: 'sheet Module-5 row 5', rule: 'R5-UNKNOWN-REVIEWER', message: "Reviewer 'Eric Munyaneza' does not match any active instructor." }],
      })],
    }))
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    expect(wrapper.text()).toContain('1 issue')
    expect(wrapper.text()).toContain("Reviewer 'Eric Munyaneza' does not match any active instructor.")
  })

  it('sends a single held notification', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    vi.mocked(reviewSvc.sendNotification).mockResolvedValue(notification({ status: 'SENT', sentAt: '2026-07-21T08:05:00Z' }))
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    // Notify lives in the notification row's ⋮ kebab, whose menu teleports to <body>. The conflict
    // queue has no kebab of its own (resolution happens in the drawer), so this is the only one.
    await wrapper.findAll('button[aria-label="Row actions"]')[0]!.trigger('click')
    await flushPromises()
    const notify = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Notify'))
    notify!.click()
    await flushPromises()

    expect(reviewSvc.sendNotification).toHaveBeenCalledWith('nt-1')
    expect(wrapper.text()).toContain('Sent')
    // Viewer-local, locale-formatted date + time (fmtDate/fmtTime) — no longer the raw UTC "yyyy-mm-dd hh:mm" slice.
    expect(wrapper.text()).toContain('Sent Jul 21, 2026 08:05')
  })

  it('shows the real backend error when sending a notification fails, not a silent title-only toast', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    vi.mocked(reviewSvc.sendNotification).mockRejectedValue(new Error('Notification provider rate limit exceeded'))
    const { wrapper, pinia } = mountView()
    await flushPromises()
    await completeSync()

    await wrapper.findAll('button[aria-label="Row actions"]')[0]!.trigger('click')
    await flushPromises()
    const notify = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Notify'))
    notify!.click()
    await flushPromises()

    const toast = useToastStore(pinia)
    const last = toast.toasts[toast.toasts.length - 1]
    expect(last?.title).toBe('Could not queue send')
    expect(last?.body).toBe('Notification provider rate limit exceeded')
  })

  it('shows the real backend error when dismissing a notification fails', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    vi.mocked(reviewSvc.dismissNotification).mockRejectedValue(new Error('Notification already sent'))
    const { wrapper, pinia } = mountView()
    await flushPromises()
    await completeSync()

    await wrapper.findAll('button[aria-label="Row actions"]')[0]!.trigger('click')
    await flushPromises()
    const dismiss = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Dismiss'))
    dismiss!.click()
    await flushPromises()

    const toast = useToastStore(pinia)
    const last = toast.toasts[toast.toasts.length - 1]
    expect(last?.title).toBe('Could not dismiss')
    expect(last?.body).toBe('Notification already sent')
  })

  it('blanks the notifications row-actions kebab once a notification is sent', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage({
      content: [notification({ status: 'SENT', sentAt: '2026-07-21T08:05:00Z' })],
    }))
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    // The sent notification has no actions left, so its cell falls back to a dash instead of a ⋮ button.
    expect(wrapper.findAll('button[aria-label="Row actions"]')).toHaveLength(0)
  })

  it('send-all queues held notifications (202 + count) and refreshes the page, reporting the count as queued not sent', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications)
      .mockResolvedValueOnce(notificationsPage())
      .mockResolvedValueOnce(notificationsPage())
    vi.mocked(reviewSvc.sendAllNotifications).mockResolvedValue(1)
    const { wrapper, pinia } = mountView()
    await flushPromises()
    await completeSync()
    // "Send all held" opens a confirmation modal first — it doesn't fire the bulk send by itself.
    await wrapper.findAll('button').find((b) => b.text().includes('Send all held'))!.trigger('click')
    await flushPromises()
    expect(reviewSvc.sendAllNotifications).not.toHaveBeenCalled()

    const confirmBtn = Array.from(document.body.querySelector('.modal-foot')!.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Send all held')
    confirmBtn!.click()
    await flushPromises()
    expect(reviewSvc.sendAllNotifications).toHaveBeenCalledWith('run-1')
    expect(reviewSvc.listNotifications).toHaveBeenCalledTimes(2)
    const toast = useToastStore(pinia)
    expect(toast.toasts[toast.toasts.length - 1]?.title).toBe('Held notifications queued')
    expect(toast.toasts[toast.toasts.length - 1]?.body).toContain('1 notification queued')
  })

  it('keeps "Send all held" enabled when the pending items are on another page than the one currently shown', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    // Current page has zero PENDING rows, but the job has more elsewhere (totalElements > this page's content).
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage({
      content: [notification({ status: 'SENT', sentAt: '2026-07-21T08:05:00Z' })],
      totalElements: 5,
      totalPages: 5,
      last: false,
    }))
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    const sendAllBtn = wrapper.findAll('button').find((b) => b.text().includes('Send all held'))!
    expect(sendAllBtn.attributes('disabled')).toBeUndefined()
  })

  it('disables "Send all held" only when the run truly has no notifications at all', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage({ content: [], totalElements: 0, totalPages: 1, last: true }))
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    const sendAllBtn = wrapper.findAll('button').find((b) => b.text().includes('Send all held'))!
    expect(sendAllBtn.attributes('disabled')).toBeDefined()
  })

  it('falls back to the raw status text for a notification status the FE does not recognize yet', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage({
      // Cast past the type — simulates the backend shipping a status the FE hasn't been updated for yet.
      content: [notification({ status: 'CANCELLED' as Notification['status'] })],
    }))
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    expect(wrapper.text()).toContain('CANCELLED')
  })

  it('reports a send that came back 200 OK but still failed, and shows the error detail', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    vi.mocked(reviewSvc.sendNotification).mockResolvedValue(notification({ status: 'FAILED', errorDetail: 'Provider timed out' }))
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    // Notify lives in the notification row's ⋮ kebab, whose menu teleports to <body>. The conflict
    // queue has no kebab of its own (resolution happens in the drawer), so this is the only one.
    await wrapper.findAll('button[aria-label="Row actions"]')[0]!.trigger('click')
    await flushPromises()
    const notify = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Notify'))
    notify!.click()
    await flushPromises()

    expect(wrapper.text()).toContain('Failed')
    expect(wrapper.text()).toContain('Provider timed out')
  })

  // The sync-run stream opens first (instances[0]); the notifications stream is started right after, in the
  // same onMounted, so it's always instances[1] across these tests (all of which use a "processing" run).
  function notifStreamEs(): FakeEventSource {
    return FakeEventSource.instances[1]!
  }

  it('live-patches a visible notification row when the SSE stream reports it sent', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    notifStreamEs().emit('notification.updated', notification({ status: 'SENT', sentAt: '2026-07-21T09:00:00Z' }))
    await flushPromises()

    expect(wrapper.text()).toContain('Sent')
    // Viewer-local, locale-formatted date + time (fmtDate/fmtTime) — no longer the raw UTC "yyyy-mm-dd hh:mm" slice.
    expect(wrapper.text()).toContain('Sent Jul 21, 2026 09:00')
  })

  it('flags new activity for a notification the stream reports off the current page, and refetches on Refresh', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    notifStreamEs().emit('notification.updated', notification({ id: 'nt-2', status: 'SENT' }))
    await flushPromises()

    expect(wrapper.text()).toContain('New notification activity')
    expect(reviewSvc.listNotifications).toHaveBeenCalledTimes(1)

    await wrapper.findAll('button').find((b) => b.text().includes('Refresh'))!.trigger('click')
    await flushPromises()

    expect(reviewSvc.listNotifications).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('New notification activity')
  })

  it('ignores a stream event for a different run', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { wrapper } = mountView()
    await flushPromises()
    await completeSync()

    notifStreamEs().emit('notification.updated', notification({ id: 'nt-9', syncJobId: 'run-9', ingestionRunId: 'run-9', status: 'SENT' }))
    await flushPromises()

    expect(wrapper.text()).not.toContain('New notification activity')
  })

  it('shows a warning toast when the stream reports a notification failed', async () => {
    vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
    vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review())
    vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage())
    vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage())
    const { pinia } = mountView()
    await flushPromises()
    await completeSync()

    notifStreamEs().emit('notification.updated', notification({ status: 'FAILED', errorDetail: 'Provider timed out' }))
    await flushPromises()

    const toast = useToastStore(pinia)
    expect(toast.toasts[toast.toasts.length - 1]?.title).toBe('Notification failed')
    expect(toast.toasts[toast.toasts.length - 1]?.body).toContain('Provider timed out')
  })

  describe('a run skipped because nothing changed', () => {
    it('names why the counts are zero instead of just labelling the status', async () => {
      vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
      vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review({
        run: { ...run, status: 'skipped', previousRunCompletedAt: '2026-07-14T08:00:05Z' },
      }))
      vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage({ content: [], totalElements: 0 }))
      vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage({ content: [], totalElements: 0 }))
      const { wrapper } = mountView()
      await flushPromises()
      await completeSync()

      // Not just "Skipped" — an admin asking "did my edit get picked up?" needs the timestamp,
      // not just a status word that reads the same whether it's good news or bad.
      expect(wrapper.text()).toContain('Skipped')
      expect(wrapper.text()).toContain('no changes since')
    })

    it("shows each file's SharePoint version on the per-workbook breakdown", async () => {
      vi.mocked(runsSvc.getRun).mockResolvedValue(processingRun)
      vi.mocked(reviewSvc.getRunReview).mockResolvedValue(review({
        run: { ...run, status: 'skipped' },
        files: [{
          workbookFilename: 'FE Lab Grading.xlsx',
          status: 'skipped',
          sharepointVersionId: 'cTag-v7',
          quickXorHash: 'quickxor-v7',
          rowsRead: 0, committedNew: 0, updatedCount: 0, skippedInvalid: 0, skippedUnchanged: 0, conflictsCount: 0,
          highFailureRate: false, failureRatePercent: 0, runAt: '2026-07-21T08:00:00Z',
          issues: [], rejectionReasons: [],
        }],
      }))
      vi.mocked(reviewSvc.listConflicts).mockResolvedValue(conflictsPage({ content: [], totalElements: 0 }))
      vi.mocked(reviewSvc.listNotifications).mockResolvedValue(notificationsPage({ content: [], totalElements: 0 }))
      const { wrapper } = mountView()
      await flushPromises()
      await completeSync()

      expect(wrapper.text()).toContain('cTag-v7')
      // The persisted per-file status reads "Unchanged" here — the same word the live-sync panel
      // uses for the identical outcome — not the raw backend string "skipped".
      expect(wrapper.text()).toContain('Unchanged')
    })
  })
})
