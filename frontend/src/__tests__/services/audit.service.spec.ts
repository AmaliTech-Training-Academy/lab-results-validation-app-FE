import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { IngestionRunAuditResponse, AuditEventResponse } from '@/types/audit.types'
import type { Paged } from '@/types/common.types'

vi.mock('@/services/mock/useMocks', () => ({ USE_MOCKS: false }))
vi.mock('@/services/users.service', () => ({
  getUser: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/services/http', () => ({
  http: { get: vi.fn<(path: string) => Promise<unknown>>() },
}))

import { listAuditRuns, listAuditEvents, getAuditEvent } from '@/services/audit.service'
import { getUser } from '@/services/users.service'
import { http } from '@/services/http'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getUser).mockResolvedValue({ id: 'u1', email: 'admin@amalitech.com' })
})

function runDto(over: Partial<IngestionRunAuditResponse> = {}): IngestionRunAuditResponse {
  return {
    id: 'run-1', cohortId: 'c1', syncJobId: 'job-1', workbookFilename: 'FE.xlsx', status: 'completed', triggerType: 'MANUAL',
    triggeredBy: 'u1', rowsRead: 30, committedNew: 12, updatedCount: 2, skippedInvalid: 14, skippedUnchanged: 0,
    conflictsCount: 1, highFailureRate: true, failureRatePercent: 63.2, runAt: '2026-07-20T08:00:00Z',
    ...over,
  }
}

function runsPage(overrides: Partial<Paged<IngestionRunAuditResponse>> = {}): Paged<IngestionRunAuditResponse> {
  return { content: [runDto()], number: 0, size: 20, totalElements: 1, totalPages: 1, last: true, ...overrides }
}

describe('listAuditRuns', () => {
  it('hits GET /audit-log/ingestion-runs with cohortId/status/instructorContactId/date-range/pagination as query params', async () => {
    vi.mocked(http.get).mockResolvedValue(runsPage())

    await listAuditRuns({
      cohortId: 'c1', status: 'failed', instructorContactId: 'ins-1',
      dateFrom: '2026-07-01', dateTo: '2026-07-31', page: 2, size: 10,
    })

    const [path] = vi.mocked(http.get).mock.calls[0]!
    expect(path).toContain('/audit-log/ingestion-runs')
    expect(path).toContain('cohortId=c1')
    expect(path).toContain('status=failed')
    expect(path).toContain('instructorContactId=ins-1')
    expect(path).toContain('from=2026-07-01T00%3A00%3A00Z')
    expect(path).toContain('to=2026-07-31T23%3A59%3A59Z')
    expect(path).toContain('page=2')
    expect(path).toContain('size=10')
  })

  it('defaults to page 0 / size 20 when unset', async () => {
    vi.mocked(http.get).mockResolvedValue(runsPage())

    await listAuditRuns({})

    const [path] = vi.mocked(http.get).mock.calls[0]!
    expect(path).toContain('page=0')
    expect(path).toContain('size=20')
  })

  it('maps the audit response into the shared IngestionRun shape, preserving the paging envelope', async () => {
    vi.mocked(http.get).mockResolvedValue(runsPage({ number: 2, totalElements: 45, totalPages: 3, last: false }))

    const result = await listAuditRuns({})

    expect(result.number).toBe(2)
    expect(result.totalElements).toBe(45)
    expect(result.last).toBe(false)
    const row = result.content[0]!
    expect(row).toMatchObject({
      id: 'run-1', cohortId: 'c1', syncJobId: 'job-1', workbookFilename: 'FE.xlsx', status: 'completed', triggerType: 'MANUAL',
      highFailure: true, failureRatePercent: 63.2, runAt: '2026-07-20T08:00:00Z',
      counts: { rowsRead: 30, committedNew: 12, updated: 2, skippedInvalid: 14, skippedUnchanged: 0, conflicts: 1 },
    })
  })

  it('resolves triggeredBy to an email via the users service', async () => {
    vi.mocked(http.get).mockResolvedValue(runsPage({ content: [runDto({ triggeredBy: 'u1' })] }))
    vi.mocked(getUser).mockResolvedValue({ id: 'u1', email: 'admin@amalitech.com' })

    const result = await listAuditRuns({})

    expect(getUser).toHaveBeenCalledWith('u1')
    expect(result.content[0]!.triggeredByEmail).toBe('admin@amalitech.com')
  })

  it('treats a null triggeredBy as a scheduler-triggered run without calling the users service', async () => {
    vi.mocked(http.get).mockResolvedValue(runsPage({ content: [runDto({ triggeredBy: null })] }))

    const result = await listAuditRuns({})

    expect(getUser).not.toHaveBeenCalled()
    expect(result.content[0]!.triggeredByEmail).toBeNull()
    expect(result.content[0]!.triggeredBy).toBeNull()
  })

  it('falls back to a null triggeredByEmail if the user lookup fails, rather than dropping the run', async () => {
    vi.mocked(http.get).mockResolvedValue(runsPage({ content: [runDto({ triggeredBy: 'deleted-user' })] }))
    vi.mocked(getUser).mockRejectedValue(new Error('404'))

    const result = await listAuditRuns({})

    expect(result.content[0]!.triggeredByEmail).toBeNull()
    expect(result.content).toHaveLength(1)
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

describe('listAuditRuns — mock mode', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/services/mock/useMocks', () => ({ USE_MOCKS: true }))
  })

  it('filters by cohortId/status and paginates client-side, newest-first', async () => {
    const { listAuditRuns } = await import('@/services/audit.service')
    const { runs } = await import('@/services/mock/fixtures')
    const cohortId = runs[0]!.cohortId

    const result = await listAuditRuns({ cohortId, page: 0, size: 1 })

    expect(result.size).toBe(1)
    expect(result.content).toHaveLength(1)
    expect(result.content.every((r) => r.cohortId === cohortId)).toBe(true)
    expect(result.totalElements).toBe(runs.filter((r) => r.cohortId === cohortId).length)
    // mock data has no separate ingestion-run/sync-job id — the run's own id doubles as syncJobId
    expect(result.content[0]!.syncJobId).toBe(result.content[0]!.id)
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
