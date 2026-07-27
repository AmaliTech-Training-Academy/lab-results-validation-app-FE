import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRunReviewStore } from '@/stores/runReview'
import type { IngestionConflict, Notification, RunReview } from '@/types/runReview.types'
import type { IngestionRun } from '@/types/run.types'

vi.mock('@/services/runReview.service', () => ({
  getRunReview: vi.fn<() => Promise<unknown>>(),
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

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useRunReviewStore', () => {
  it('fetchReview loads the aggregate', async () => {
    vi.mocked(svc.getRunReview).mockResolvedValue(review())
    const store = useRunReviewStore()
    await store.fetchReview('run-1')
    expect(store.review?.conflicts).toHaveLength(1)
    expect(store.review?.notifications).toHaveLength(2)
  })

  it('resolveConflict replaces the conflict in place', async () => {
    vi.mocked(svc.getRunReview).mockResolvedValue(review())
    vi.mocked(svc.resolveConflict).mockResolvedValue(conflict({ status: 'RESOLVED', resolutionNote: 'kept row 1' }))
    const store = useRunReviewStore()
    await store.fetchReview('run-1')
    await store.resolveConflict('cf-1', { chosenRowIndex: 0 })
    expect(store.review?.conflicts[0]!.status).toBe('RESOLVED')
  })

  it('sendNotification marks the item sent', async () => {
    vi.mocked(svc.getRunReview).mockResolvedValue(review())
    vi.mocked(svc.sendNotification).mockResolvedValue(notif({ status: 'SENT', sentAt: '2026-07-21T08:00:00Z' }))
    const store = useRunReviewStore()
    await store.fetchReview('run-1')
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
    await store.fetchReview('run-1')
    await store.sendAll('run-1')
    expect(store.review?.notifications.every((n) => n.status === 'SENT')).toBe(true)
  })
})
