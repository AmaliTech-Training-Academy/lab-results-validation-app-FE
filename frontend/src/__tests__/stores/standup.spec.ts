import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useStandupStore } from '@/stores/standup'
import type { StandupStatus } from '@/types/standup.types'

vi.mock('@/services/cohorts.service', () => ({
  attachSharePointLink: vi.fn<() => Promise<unknown>>(),
  fetchStandupStatus: vi.fn<() => Promise<unknown>>(),
  hasStandupRun: vi.fn<() => Promise<unknown>>(),
  hasGate4Run: vi.fn<() => Promise<unknown>>(),
  acceptCohortReference: vi.fn<() => Promise<unknown>>(),
  discardCohortReference: vi.fn<() => Promise<unknown>>(),
}))
import * as svc from '@/services/cohorts.service'

const RUNNING: StandupStatus = {
  overall: 'running',
  gates: [{ id: 'gate1', label: 'Gate 1', status: 'running', errors: [] }],
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useStandupStore', () => {
  it('start() forwards the link to the service', async () => {
    vi.mocked(svc.attachSharePointLink).mockResolvedValue(undefined)
    const store = useStandupStore()
    await store.start('c1', 'https://sp/Cohort1')
    expect(svc.attachSharePointLink).toHaveBeenCalledWith('c1', { folderUrl: 'https://sp/Cohort1' })
  })

  it('hasRun() delegates to the existence-check service (FND-58)', async () => {
    vi.mocked(svc.hasStandupRun).mockResolvedValue(true)
    const store = useStandupStore()
    expect(await store.hasRun('c1')).toBe(true)
    expect(svc.hasStandupRun).toHaveBeenCalledWith('c1')
  })

  it('hasGate4() delegates to the existence-check service (FND-58)', async () => {
    vi.mocked(svc.hasGate4Run).mockResolvedValue(true)
    const store = useStandupStore()
    expect(await store.hasGate4('c1')).toBe(true)
    expect(svc.hasGate4Run).toHaveBeenCalledWith('c1')
  })

  it('refresh() stores and returns the latest status', async () => {
    vi.mocked(svc.fetchStandupStatus).mockResolvedValue(RUNNING)
    const store = useStandupStore()
    const result = await store.refresh('c1')
    expect(result).toEqual(RUNNING)
    expect(store.status).toEqual(RUNNING)
  })

  it('accept() calls the service', async () => {
    vi.mocked(svc.acceptCohortReference).mockResolvedValue(undefined)
    const store = useStandupStore()
    await store.accept('c1')
    expect(svc.acceptCohortReference).toHaveBeenCalledWith('c1')
  })

  it('discard() clears the status', async () => {
    vi.mocked(svc.fetchStandupStatus).mockResolvedValue(RUNNING)
    vi.mocked(svc.discardCohortReference).mockResolvedValue(undefined)
    const store = useStandupStore()
    await store.refresh('c1')
    expect(store.status).not.toBeNull()
    await store.discard('c1')
    expect(svc.discardCohortReference).toHaveBeenCalledWith('c1')
    expect(store.status).toBeNull()
  })

  it('start() surfaces and rethrows a failure', async () => {
    vi.mocked(svc.attachSharePointLink).mockRejectedValue(new Error('no access'))
    const store = useStandupStore()
    await expect(store.start('c1', 'bad')).rejects.toThrow('no access')
    expect(store.error).toBe('no access')
  })

  it('accept() surfaces the backend\'s real message and rethrows so the caller can stop the chain', async () => {
    vi.mocked(svc.acceptCohortReference).mockRejectedValue(new Error('Reference bundle failed integrity check'))
    const store = useStandupStore()
    await expect(store.accept('c1')).rejects.toThrow('Reference bundle failed integrity check')
    expect(store.error).toBe('Reference bundle failed integrity check')
    expect(store.busy).toBe(false)
  })
})
