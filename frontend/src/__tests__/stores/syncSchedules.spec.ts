import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSyncSchedulesStore } from '@/stores/syncSchedules'
import type { SyncScheduleResponse } from '@/types/syncSchedule.types'

vi.mock('@/services/syncSchedules.service', () => ({
  listSyncSchedules: vi.fn<() => Promise<unknown>>(),
  getSyncSchedule: vi.fn<() => Promise<unknown>>(),
  createSyncSchedule: vi.fn<() => Promise<unknown>>(),
  updateSyncSchedule: vi.fn<() => Promise<unknown>>(),
  removeSyncSchedule: vi.fn<() => Promise<unknown>>(),
}))
import * as svc from '@/services/syncSchedules.service'

function schedule(over: Partial<SyncScheduleResponse> = {}): SyncScheduleResponse {
  return {
    id: 's1',
    name: 'Nightly sync',
    cohortId: null,
    frequency: 'DAILY',
    timeOfDay: '02:00',
    dayOfWeek: null,
    timezone: 'GMT',
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useSyncSchedulesStore', () => {
  it('fetchList populates list and clears loading', async () => {
    vi.mocked(svc.listSyncSchedules).mockResolvedValue([schedule(), schedule({ id: 's2' })])
    const store = useSyncSchedulesStore()
    await store.fetchList()
    expect(store.list).toHaveLength(2)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchList surfaces an error', async () => {
    vi.mocked(svc.listSyncSchedules).mockRejectedValue(new Error('offline'))
    const store = useSyncSchedulesStore()
    await store.fetchList()
    expect(store.error).toBe('offline')
    expect(store.list).toEqual([])
  })

  it('create prepends the new schedule and returns it', async () => {
    vi.mocked(svc.listSyncSchedules).mockResolvedValue([schedule({ id: 'existing' })])
    const created = schedule({ id: 'new', name: 'Weekly sync' })
    vi.mocked(svc.createSyncSchedule).mockResolvedValue(created)
    const store = useSyncSchedulesStore()
    await store.fetchList()
    const result = await store.create({ name: 'Weekly sync', frequency: 'DAILY', timeOfDay: '02:00', enabled: true })
    expect(result).toEqual(created)
    expect(store.list[0]).toEqual(created)
    expect(store.list).toHaveLength(2)
  })

  it('create propagates a failure', async () => {
    vi.mocked(svc.createSyncSchedule).mockRejectedValue(new Error('name required'))
    const store = useSyncSchedulesStore()
    await expect(
      store.create({ name: '', frequency: 'DAILY', timeOfDay: '02:00', enabled: true }),
    ).rejects.toThrow('name required')
    expect(store.error).toBe('name required')
  })

  it('update replaces the row in list and current', async () => {
    const existing = schedule({ id: 's1', enabled: true })
    vi.mocked(svc.listSyncSchedules).mockResolvedValue([existing])
    vi.mocked(svc.getSyncSchedule).mockResolvedValue(existing)
    const updated = schedule({ id: 's1', enabled: false })
    vi.mocked(svc.updateSyncSchedule).mockResolvedValue(updated)

    const store = useSyncSchedulesStore()
    await store.fetchList()
    await store.fetchOne('s1')
    const result = await store.update('s1', { name: existing.name, frequency: 'DAILY', timeOfDay: '02:00', enabled: false })

    expect(result).toEqual(updated)
    expect(store.list[0]).toEqual(updated)
    expect(store.current).toEqual(updated)
  })

  it('remove splices the schedule from the list', async () => {
    vi.mocked(svc.listSyncSchedules).mockResolvedValue([schedule({ id: 's1' }), schedule({ id: 's2' })])
    vi.mocked(svc.removeSyncSchedule).mockResolvedValue(undefined)
    const store = useSyncSchedulesStore()
    await store.fetchList()
    await store.remove('s1')
    expect(store.list.map((s) => s.id)).toEqual(['s2'])
  })
})
