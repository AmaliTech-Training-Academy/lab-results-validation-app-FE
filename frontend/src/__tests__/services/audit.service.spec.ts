import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { IngestionRun } from '@/types/run.types'
import type { Cohort } from '@/types/domain.types'
import type { AuditEventResponse } from '@/types/audit.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/mock/useMocks', () => ({ USE_MOCKS: false }))
vi.mock('@/services/runs.service', () => ({
  listRuns: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/cohorts.service', () => ({
  listCohorts: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/users.service', () => ({
  getUser: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/http', () => ({
  http: { get: vi.fn<(path: string) => Promise<unknown>>() },
}))

import { listAuditRuns, listAuditEvents, getAuditEvent } from '@/services/audit.service'
import { listRuns } from '@/services/runs.service'
import { listCohorts } from '@/services/cohorts.service'
import { getUser } from '@/services/users.service'
import { http } from '@/services/http'

function run(over: Partial<IngestionRun> = {}): IngestionRun {
  return { id: 'run-1', cohortId: 'c1', status: 'completed', runAt: '2026-07-20T08:00:00Z', ...over }
}

function cohort(over: Partial<Cohort> = {}): Cohort {
  return {
    id: 'c1', name: 'Cohort 1', startDate: '2026-01-01', endDate: '2026-06-01',
    lifecycleState: 'STOOD_UP', locked: false, active: true, sharepointFolderUrl: null, createdAt: '2026-01-01',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getUser).mockResolvedValue({ id: 'u1', email: 'admin@amalitech.com' })
})

describe('listAuditRuns', () => {
  it('lists a single cohort directly when cohortId is given, without fetching every cohort', async () => {
    vi.mocked(listRuns).mockResolvedValue([run({ id: 'run-1' })])

    const result = await listAuditRuns({ cohortId: 'c1' })

    expect(listRuns).toHaveBeenCalledWith('c1')
    expect(listCohorts).not.toHaveBeenCalled()
    expect(result).toEqual([run({ id: 'run-1' })])
  })

  it('fans out over every stood-up cohort and merges when no cohort filter is set (no cross-cohort endpoint exists)', async () => {
    vi.mocked(listCohorts).mockResolvedValue([
      cohort({ id: 'c1', lifecycleState: 'STOOD_UP' }),
      cohort({ id: 'c2', lifecycleState: 'STOOD_UP' }),
      cohort({ id: 'c3', lifecycleState: 'DRAFT' as Cohort['lifecycleState'] }),
    ])
    vi.mocked(listRuns).mockImplementation(async (cohortId: string) =>
      cohortId === 'c1'
        ? [run({ id: 'run-old', cohortId: 'c1', runAt: '2026-07-01T08:00:00Z' })]
        : [run({ id: 'run-new', cohortId: 'c2', runAt: '2026-07-20T08:00:00Z' })],
    )

    const result = await listAuditRuns({})

    expect(listRuns).toHaveBeenCalledWith('c1')
    expect(listRuns).toHaveBeenCalledWith('c2')
    expect(listRuns).not.toHaveBeenCalledWith('c3')
    // newest-first across cohorts
    expect(result.map((r) => r.id)).toEqual(['run-new', 'run-old'])
  })

  it('applies status and date-range filters client-side after merging', async () => {
    vi.mocked(listRuns).mockResolvedValue([
      run({ id: 'run-completed', status: 'completed', runAt: '2026-07-20T08:00:00Z' }),
      run({ id: 'run-failed', status: 'failed', runAt: '2026-07-21T08:00:00Z' }),
    ])

    const result = await listAuditRuns({ cohortId: 'c1', status: 'failed' })

    expect(result.map((r) => r.id)).toEqual(['run-failed'])
  })
})

function eventResponse(over: Partial<AuditEventResponse> = {}): AuditEventResponse {
  return {
    id: 'ev-1', eventType: 'STOOD_UP', cohortId: 'c1', actorUserId: 'u1',
    payload: null, occurredAt: '2026-07-20T08:00:00Z',
    ...over,
  }
}

function page(overrides: Partial<Paged<AuditEventResponse>> = {}): Paged<AuditEventResponse> {
  return { content: [eventResponse()], number: 0, size: 20, totalElements: 1, totalPages: 1, last: true, ...overrides }
}

describe('listAuditEvents', () => {
  it('hits GET /audit-log/audit-events with cohortId/eventType/date-range/pagination as query params', async () => {
    vi.mocked(http.get).mockResolvedValue(page())

    await listAuditEvents({ cohortId: 'c1', eventType: 'COHORT_LOCKED', dateFrom: '2026-07-01', dateTo: '2026-07-31', page: 2, size: 10 })

    const [path] = vi.mocked(http.get).mock.calls[0]!
    expect(path).toContain('/audit-log/audit-events')
    expect(path).toContain('cohortId=c1')
    expect(path).toContain('eventType=COHORT_LOCKED')
    expect(path).toContain('from=2026-07-01T00%3A00%3A00Z')
    expect(path).toContain('to=2026-07-31T23%3A59%3A59Z')
    expect(path).toContain('page=2')
    expect(path).toContain('size=10')
  })

  it('defaults to page 0 / size 20 when unset', async () => {
    vi.mocked(http.get).mockResolvedValue(page())

    await listAuditEvents({})

    const [path] = vi.mocked(http.get).mock.calls[0]!
    expect(path).toContain('page=0')
    expect(path).toContain('size=20')
  })

  it('resolves actorUserId to an email via the users service', async () => {
    vi.mocked(http.get).mockResolvedValue(page({ content: [eventResponse({ actorUserId: 'u1' })] }))
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', email: 'admin@amalitech.com' })

    const result = await listAuditEvents({})

    expect(getUser).toHaveBeenCalledWith('u1')
    expect(result.content[0]!.actorEmail).toBe('admin@amalitech.com')
  })

  it('treats a null actorUserId as SYSTEM without calling the users service', async () => {
    vi.mocked(http.get).mockResolvedValue(page({ content: [eventResponse({ actorUserId: null })] }))

    const result = await listAuditEvents({})

    expect(getUser).not.toHaveBeenCalled()
    expect(result.content[0]!.actorEmail).toBeNull()
  })

  it('falls back to a null actorEmail if the user lookup fails, rather than dropping the event', async () => {
    vi.mocked(http.get).mockResolvedValue(page({ content: [eventResponse({ actorUserId: 'deleted-user' })] }))
    vi.mocked(getUser).mockRejectedValue(new Error('404'))

    const result = await listAuditEvents({})

    expect(result.content[0]!.actorEmail).toBeNull()
    expect(result.content).toHaveLength(1)
  })
})

describe('getAuditEvent', () => {
  it('hits GET /audit-log/audit-events/{id} and resolves the actor email', async () => {
    vi.mocked(http.get).mockResolvedValue(eventResponse({ id: 'ev-42', actorUserId: 'u1' }))
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', email: 'admin@amalitech.com' })

    const result = await getAuditEvent('ev-42')

    expect(http.get).toHaveBeenCalledWith('/audit-log/audit-events/ev-42')
    expect(result.id).toBe('ev-42')
    expect(result.actorEmail).toBe('admin@amalitech.com')
  })
})
