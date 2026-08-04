import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRunReviewStore } from '@/stores/runReview'
import type { IngestionConflict, IngestionConflictResponse, Notification, RunReview } from '@/types/runReview.types'
import type { IngestionRun } from '@/types/run.types'
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
}))
import * as svc from '@/services/runReview.service'

const run = { id: 'run-1', counts: {} } as unknown as IngestionRun

function conflict(over: Partial<IngestionConflict> = {}): IngestionConflict {
  return {
    id: 'cf-1',
    ingestionRunId: 'run-1',
    cohortId: 'c1',
    conflictKind: 'in_file_duplicate',
    existingResult: null,
    incomingRows: [],
    status: 'PENDING',
    ...over,
  }
}
function notif(over: Partial<Notification> = {}): Notification {
  return {
    id: 'nt-1',
    ingestionRunId: 'run-1',
    cohortId: 'c1',
    type: 'instructor_digest',
    recipientKind: 'instructor',
    dispatchPolicy: 'HELD',
    status: 'PENDING',
    issues: [],
    ...over,
  }
}
function review(): RunReview {
  return { run, conflicts: [conflict()], notifications: [] }
}

function conflictResponse(over: Partial<IngestionConflictResponse> = {}): IngestionConflictResponse {
  return {
    id: 'cf-1', ingestionRunId: 'run-1', cohortId: 'c1', learnerId: 'DEG-1', labId: 'lab-1',
    conflictKind: 'in_file_duplicate', existingResultId: null, incomingPayload: {},
    status: 'PENDING', resolvedBy: null, resolvedAt: null, resolutionNote: null,
    createdAt: '2026-07-21T08:01:00Z', updatedAt: '2026-07-21T08:01:00Z',
    ...over,
  }
}

function page(overrides: Partial<Paged<IngestionConflictResponse>> = {}): Paged<IngestionConflictResponse> {
  return { content: [conflictResponse()], number: 0, size: 20, totalElements: 1, totalPages: 1, last: true, ...overrides }
}

function notifPage(overrides: Partial<Paged<Notification>> = {}): Paged<Notification> {
  return { content: [notif(), notif({ id: 'nt-2' })], number: 0, size: 20, totalElements: 2, totalPages: 1, last: true, ...overrides }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useRunReviewStore', () => {
  it('fetchReview loads the aggregate', async () => {
    vi.mocked(svc.getRunReview).mockResolvedValue(review())
    const store = useRunReviewStore()
    await store.fetchReview('c1', 'run-1')
    expect(store.review?.conflicts).toHaveLength(1)
  })

  it('resolveConflict patches the matching row in the conflicts page', async () => {
    vi.mocked(svc.listConflicts).mockResolvedValue(page())
    vi.mocked(svc.resolveConflict).mockResolvedValue(
      conflictResponse({ status: 'RESOLVED', resolutionNote: 'kept incoming' }),
    )
    const store = useRunReviewStore()
    await store.fetchConflicts('c1', 'run-1')
    await store.resolveConflict('c1', 'cf-1', { action: 'KEEP_INCOMING' })
    expect(svc.resolveConflict).toHaveBeenCalledWith('c1', 'cf-1', { action: 'KEEP_INCOMING' })
    expect(store.conflictsPage?.content[0]!.status).toBe('RESOLVED')
    expect(store.conflictsPage?.content[0]!.resolutionNote).toBe('kept incoming')
  })

  it('fetchConflicts loads a page for the run', async () => {
    vi.mocked(svc.listConflicts).mockResolvedValue(page())
    const store = useRunReviewStore()
    await store.fetchConflicts('c1', 'run-1')
    expect(svc.listConflicts).toHaveBeenCalledWith('c1', 'run-1', { status: undefined, page: 0, size: 20 })
    expect(store.conflictsPage?.content).toHaveLength(1)
  })

  it('fetchConflicts surfaces a load error', async () => {
    vi.mocked(svc.listConflicts).mockRejectedValue(new Error('boom'))
    const store = useRunReviewStore()
    await store.fetchConflicts('c1', 'run-1')
    expect(store.conflictsError).toBe('boom')
  })

  it('setConflictsStatusFilter re-fetches page 0 with the new status', async () => {
    vi.mocked(svc.listConflicts).mockResolvedValue(page())
    const store = useRunReviewStore()
    await store.fetchConflicts('c1', 'run-1', 1)
    await store.setConflictsStatusFilter('c1', 'run-1', 'RESOLVED')
    expect(svc.listConflicts).toHaveBeenLastCalledWith('c1', 'run-1', { status: 'RESOLVED', page: 0, size: 20 })
  })

  it('fetchNotifications loads a page scoped to the cohort + sync job', async () => {
    vi.mocked(svc.listNotifications).mockResolvedValue(notifPage())
    const store = useRunReviewStore()
    await store.fetchNotifications('c1', 'run-1')
    expect(svc.listNotifications).toHaveBeenCalledWith({ cohortId: 'c1', syncJobId: 'run-1', status: undefined, page: 0, size: 20 })
    expect(store.notificationsPage?.content).toHaveLength(2)
  })

  it('fetchNotifications surfaces a load error', async () => {
    vi.mocked(svc.listNotifications).mockRejectedValue(new Error('boom'))
    const store = useRunReviewStore()
    await store.fetchNotifications('c1', 'run-1')
    expect(store.notificationsError).toBe('boom')
  })

  it('setNotificationsStatusFilter re-fetches page 0 with the new status', async () => {
    vi.mocked(svc.listNotifications).mockResolvedValue(notifPage())
    const store = useRunReviewStore()
    await store.fetchNotifications('c1', 'run-1', 1)
    await store.setNotificationsStatusFilter('c1', 'run-1', 'PENDING')
    expect(svc.listNotifications).toHaveBeenLastCalledWith({ cohortId: 'c1', syncJobId: 'run-1', status: 'PENDING', page: 0, size: 20 })
  })

  it('sendNotification patches the matching row in the notifications page', async () => {
    vi.mocked(svc.listNotifications).mockResolvedValue(notifPage())
    vi.mocked(svc.sendNotification).mockResolvedValue(notif({ status: 'SENT', sentAt: '2026-07-21T08:00:00Z' }))
    const store = useRunReviewStore()
    await store.fetchNotifications('c1', 'run-1')
    await store.sendNotification('nt-1')
    expect(store.notificationsPage?.content.find((n) => n.id === 'nt-1')?.status).toBe('SENT')
  })

  it('sendAll dispatches then refetches the current notifications page, returning the queued count', async () => {
    vi.mocked(svc.listNotifications)
      .mockResolvedValueOnce(notifPage())
      .mockResolvedValueOnce(notifPage({ content: [notif({ status: 'SENT' }), notif({ id: 'nt-2', status: 'SENT' })] }))
    vi.mocked(svc.sendAllNotifications).mockResolvedValue(2)
    const store = useRunReviewStore()
    await store.fetchNotifications('c1', 'run-1')
    const queued = await store.sendAll('c1', 'run-1')
    expect(svc.sendAllNotifications).toHaveBeenCalledWith('run-1')
    expect(svc.listNotifications).toHaveBeenCalledTimes(2)
    expect(queued).toBe(2)
    // The refetch is best-effort — send-all is fire-and-forget (202), so this just reflects whatever's true at refetch time.
    expect(store.notificationsPage?.content.every((n) => n.status === 'SENT')).toBe(true)
  })

  it('sendNotification is fire-and-forget — it patches the row from the queued response without throwing', async () => {
    vi.mocked(svc.listNotifications).mockResolvedValue(notifPage())
    vi.mocked(svc.sendNotification).mockResolvedValue(notif({ status: 'PENDING' }))
    const store = useRunReviewStore()
    await store.fetchNotifications('c1', 'run-1')
    await expect(store.sendNotification('nt-1')).resolves.toBeUndefined()
    expect(store.notificationsPage?.content.find((n) => n.id === 'nt-1')?.status).toBe('PENDING')
  })
})
