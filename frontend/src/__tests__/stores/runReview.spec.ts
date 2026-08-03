import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRunReviewStore } from '@/stores/runReview'
import type { IngestionConflict, IngestionConflictResponse, Notification, RunReview } from '@/types/runReview.types'
import type { IngestionRun } from '@/types/run.types'
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
    ...over,
  }
}
function review(): RunReview {
  return { run, conflicts: [conflict()], notifications: [notif(), notif({ id: 'nt-2' })] }
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
    expect(store.review?.notifications).toHaveLength(2)
  })

  it('resolveConflict replaces the conflict in place', async () => {
    vi.mocked(svc.getRunReview).mockResolvedValue(review())
    vi.mocked(svc.resolveConflict).mockResolvedValue(conflict({ status: 'RESOLVED', resolutionNote: 'kept row 1' }))
    const store = useRunReviewStore()
    await store.fetchReview('c1', 'run-1')
    await store.resolveConflict('cf-1', { chosenRowIndex: 0 })
    expect(store.review?.conflicts[0]!.status).toBe('RESOLVED')
  })

  it('sendNotification marks the item sent', async () => {
    vi.mocked(svc.getRunReview).mockResolvedValue(review())
    vi.mocked(svc.sendNotification).mockResolvedValue(notif({ status: 'SENT', sentAt: '2026-07-21T08:00:00Z' }))
    const store = useRunReviewStore()
    await store.fetchReview('c1', 'run-1')
    await store.sendNotification('nt-1')
    expect(store.review?.notifications.find((n) => n.id === 'nt-1')?.status).toBe('SENT')
  })

  it('sendAll updates every returned notification', async () => {
    vi.mocked(svc.getRunReview).mockResolvedValue(review())
    vi.mocked(svc.sendAllNotifications).mockResolvedValue([
      notif({ id: 'nt-1', status: 'SENT' }),
      notif({ id: 'nt-2', status: 'SENT' }),
    ])
    const store = useRunReviewStore()
    await store.fetchReview('c1', 'run-1')
    await store.sendAll('run-1')
    expect(store.review?.notifications.every((n) => n.status === 'SENT')).toBe(true)
  })

  it('fetchConflicts loads a page for the run', async () => {
    vi.mocked(svc.listConflicts).mockResolvedValue(page())
    const store = useRunReviewStore()
    await store.fetchConflicts('run-1')
    expect(svc.listConflicts).toHaveBeenCalledWith('run-1', { status: undefined, page: 0, size: 20 })
    expect(store.conflictsPage?.content).toHaveLength(1)
  })

  it('fetchConflicts surfaces a load error', async () => {
    vi.mocked(svc.listConflicts).mockRejectedValue(new Error('boom'))
    const store = useRunReviewStore()
    await store.fetchConflicts('run-1')
    expect(store.conflictsError).toBe('boom')
  })

  it('setConflictsStatusFilter re-fetches page 0 with the new status', async () => {
    vi.mocked(svc.listConflicts).mockResolvedValue(page())
    const store = useRunReviewStore()
    await store.fetchConflicts('run-1', 1)
    await store.setConflictsStatusFilter('run-1', 'RESOLVED')
    expect(svc.listConflicts).toHaveBeenLastCalledWith('run-1', { status: 'RESOLVED', page: 0, size: 20 })
  })
})
