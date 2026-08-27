import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConflictsStore } from '@/stores/conflicts'

vi.mock('@/services/runReview.service', () => ({
  listCohortConflicts: vi.fn<() => Promise<unknown>>(),
}))
import * as svc from '@/services/runReview.service'

function totalPage(totalElements: number) {
  return { content: [], number: 0, size: 1, totalElements, totalPages: 1, last: true }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useConflictsStore.fetchTotalOpen', () => {
  it('sums the open-conflict total across every cohort', async () => {
    vi.mocked(svc.listCohortConflicts)
      .mockResolvedValueOnce(totalPage(3))
      .mockResolvedValueOnce(totalPage(5))
      .mockResolvedValueOnce(totalPage(2))
    const store = useConflictsStore()

    await store.fetchTotalOpen(['c1', 'c2', 'c3'])

    expect(store.totalOpen).toBe(10)
    expect(store.error).toBeNull()
  })

  it('keeps the partial total and no error when only one cohort fails', async () => {
    vi.mocked(svc.listCohortConflicts)
      .mockResolvedValueOnce(totalPage(4))
      .mockRejectedValueOnce(new Error('c2 offline'))
      .mockResolvedValueOnce(totalPage(1))
    const store = useConflictsStore()

    await store.fetchTotalOpen(['c1', 'c2', 'c3'])

    expect(store.totalOpen).toBe(5)
    expect(store.error).toBeNull()
  })

  it('surfaces an error when every cohort request fails', async () => {
    vi.mocked(svc.listCohortConflicts).mockRejectedValue(new Error('offline'))
    const store = useConflictsStore()

    await store.fetchTotalOpen(['c1', 'c2'])

    expect(store.totalOpen).toBe(0)
    expect(store.error).toBe('offline')
  })

  it('resets to zero without a request when there are no eligible cohorts', async () => {
    const store = useConflictsStore()
    store.totalOpen = 7

    await store.fetchTotalOpen([])

    expect(store.totalOpen).toBe(0)
    expect(svc.listCohortConflicts).not.toHaveBeenCalled()
  })
})
