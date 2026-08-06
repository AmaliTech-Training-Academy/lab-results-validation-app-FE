import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuditStore } from '@/stores/audit'
import type { IngestionRun } from '@/types/run.types'
import type { AuditEvent } from '@/types/audit.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/audit.service', () => ({
  listAuditRuns: vi.fn<() => Promise<unknown>>(),
  listAuditEvents: vi.fn<() => Promise<unknown>>(),
  getAuditEvent: vi.fn<() => Promise<unknown>>(),
}))
import * as svc from '@/services/audit.service'

function run(over: Partial<IngestionRun> = {}): IngestionRun {
  return { id: 'run-1', cohortId: 'c1', status: 'completed', runAt: '2026-07-20T08:00:00Z', ...over }
}

function runsPage(overrides: Partial<Paged<IngestionRun>> = {}): Paged<IngestionRun> {
  return { content: [run()], number: 0, size: 20, totalElements: 1, totalPages: 1, last: true, ...overrides }
}

function event(over: Partial<AuditEvent> = {}): AuditEvent {
  return { id: 'ev-1', eventType: 'STOOD_UP', cohortId: 'c1', actorEmail: null, occurredAt: '2026-07-20T08:00:00Z', ...over }
}

function page(overrides: Partial<Paged<AuditEvent>> = {}): Paged<AuditEvent> {
  return { content: [event()], number: 0, size: 20, totalElements: 1, totalPages: 1, last: true, ...overrides }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useAuditStore', () => {
  it('fetch loads the first page of runs and events together, storing the filters used', async () => {
    vi.mocked(svc.listAuditRuns).mockResolvedValue(runsPage())
    vi.mocked(svc.listAuditEvents).mockResolvedValue(page())

    const store = useAuditStore()
    await store.fetch({ cohortId: 'c1' })

    expect(store.runsPage?.content).toHaveLength(1)
    expect(store.eventsPage?.content).toHaveLength(1)
    expect(svc.listAuditRuns).toHaveBeenCalledWith({ cohortId: 'c1', page: 0, size: 20 })
    expect(svc.listAuditEvents).toHaveBeenCalledWith({ cohortId: 'c1', page: 0, size: 20 })
    expect(store.filters).toEqual({ cohortId: 'c1' })
  })

  it('fetchRuns pages independently of events, reusing the stored filters', async () => {
    vi.mocked(svc.listAuditRuns).mockResolvedValue(runsPage())
    vi.mocked(svc.listAuditEvents).mockResolvedValue(page())

    const store = useAuditStore()
    await store.fetch({ status: 'failed' })
    vi.mocked(svc.listAuditRuns).mockResolvedValue(runsPage({ number: 1, last: true }))

    await store.fetchRuns(1)

    expect(svc.listAuditRuns).toHaveBeenLastCalledWith({ status: 'failed', page: 1, size: 20 })
    expect(svc.listAuditEvents).toHaveBeenCalledTimes(1)
    expect(store.runsPage?.number).toBe(1)
  })

  it('fetchEvents pages independently of runs, reusing the stored filters', async () => {
    vi.mocked(svc.listAuditRuns).mockResolvedValue(runsPage())
    vi.mocked(svc.listAuditEvents).mockResolvedValue(page())

    const store = useAuditStore()
    await store.fetch({ status: 'failed' })
    vi.mocked(svc.listAuditEvents).mockResolvedValue(page({ number: 1, last: true }))

    await store.fetchEvents(1)

    expect(svc.listAuditEvents).toHaveBeenLastCalledWith({ status: 'failed', page: 1, size: 20 })
    expect(svc.listAuditRuns).toHaveBeenCalledTimes(1)
    expect(store.eventsPage?.number).toBe(1)
  })

  it('surfaces separate load errors for runs and events', async () => {
    vi.mocked(svc.listAuditRuns).mockRejectedValue(new Error('runs boom'))
    vi.mocked(svc.listAuditEvents).mockRejectedValue(new Error('events boom'))

    const store = useAuditStore()
    await store.fetch()

    expect(store.error).toBe('runs boom')
    expect(store.eventsError).toBe('events boom')
  })

  it('fetchRuns ignores a slower, superseded response so a stale page cannot clobber a newer one', async () => {
    const store = useAuditStore()
    let resolveStale!: (p: Paged<IngestionRun>) => void
    vi.mocked(svc.listAuditRuns)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve }))
      .mockResolvedValueOnce(runsPage({ number: 1, content: [run({ id: 'run-fresh' })] }))
    vi.mocked(svc.listAuditEvents).mockResolvedValue(page())

    const staleFetch = store.fetchRuns(0)
    await store.fetchRuns(1)
    resolveStale(runsPage({ number: 0 }))
    await staleFetch

    expect(store.runsPage?.number).toBe(1)
    expect(store.runsPage?.content[0]!.id).toBe('run-fresh')
  })

  it('fetchEvent loads a single event by id into currentEvent', async () => {
    vi.mocked(svc.getAuditEvent).mockResolvedValue(event({ id: 'ev-42' }))

    const store = useAuditStore()
    await store.fetchEvent('ev-42')

    expect(svc.getAuditEvent).toHaveBeenCalledWith('ev-42')
    expect(store.currentEvent?.id).toBe('ev-42')
    expect(store.currentEventLoading).toBe(false)
  })

  it('fetchEvent surfaces a load error without touching the runs/events state', async () => {
    vi.mocked(svc.getAuditEvent).mockRejectedValue(new Error('Event not found'))

    const store = useAuditStore()
    await store.fetchEvent('missing')

    expect(store.currentEventError).toBe('Event not found')
    expect(store.currentEvent).toBeNull()
  })
})
