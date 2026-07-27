import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCohortsStore } from '@/stores/cohorts'
import type { Cohort } from '@/types/domain.types'

vi.mock('@/services/cohorts.service', () => ({
  listCohorts: vi.fn<() => Promise<unknown>>(),
  getCohort: vi.fn<() => Promise<unknown>>(),
  createCohort: vi.fn<() => Promise<unknown>>(),
  lockCohort: vi.fn<() => Promise<unknown>>(),
  unlockCohort: vi.fn<() => Promise<unknown>>(),
}))
import * as svc from '@/services/cohorts.service'

function cohort(over: Partial<Cohort> = {}): Cohort {
  return {
    id: 'c1',
    name: 'Cohort 1',
    startDate: '2026-01-01',
    endDate: '2026-06-01',
    lifecycleState: 'DRAFT',
    locked: false,
    active: true,
    sharepointFolderUrl: null,
    referenceAcceptedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useCohortsStore', () => {
  it('fetchList populates list and clears loading', async () => {
    vi.mocked(svc.listCohorts).mockResolvedValue([cohort(), cohort({ id: 'c2', name: 'Cohort 2' })])
    const store = useCohortsStore()
    await store.fetchList()
    expect(store.list).toHaveLength(2)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchList surfaces an error', async () => {
    vi.mocked(svc.listCohorts).mockRejectedValue(new Error('offline'))
    const store = useCohortsStore()
    await store.fetchList()
    expect(store.error).toBe('offline')
    expect(store.list).toEqual([])
  })

  it('createCohort prepends the new cohort and returns it', async () => {
    vi.mocked(svc.listCohorts).mockResolvedValue([cohort({ id: 'existing' })])
    const created = cohort({ id: 'new', name: 'Cohort 9' })
    vi.mocked(svc.createCohort).mockResolvedValue(created)
    const store = useCohortsStore()
    await store.fetchList()
    const result = await store.createCohort({ name: 'Cohort 9', startDate: '2026-03-01', endDate: '2026-08-01' })
    expect(result).toEqual(created)
    expect(store.list[0]).toEqual(created)
    expect(store.list).toHaveLength(2)
  })

  it('createCohort propagates a duplicate-name error', async () => {
    vi.mocked(svc.createCohort).mockRejectedValue(new Error('Cohort name must be unique'))
    const store = useCohortsStore()
    await expect(
      store.createCohort({ name: 'dupe', startDate: '2026-01-01', endDate: '2026-02-01' }),
    ).rejects.toThrow('Cohort name must be unique')
  })

  it('lock/unlock patch the row in the list', async () => {
    vi.mocked(svc.listCohorts).mockResolvedValue([cohort({ id: 'c1', lifecycleState: 'STOOD_UP' })])
    vi.mocked(svc.lockCohort).mockResolvedValue(undefined)
    vi.mocked(svc.unlockCohort).mockResolvedValue(undefined)
    const store = useCohortsStore()
    await store.fetchList()
    await store.lock('c1')
    expect(store.list[0]!.locked).toBe(true)
    await store.unlock('c1')
    expect(store.list[0]!.locked).toBe(false)
  })
})
