// Audit log: historical runs + lifecycle events (PRD Epic D D5, FE strategy §8).
import { http } from './http'
import type { IngestionRun, RunStatus, TriggerType } from '@/types/run.types'
import type { AuditEvent, AuditEventResponse, AuditFilters, IngestionRunAuditResponse } from '@/types/audit.types'
import type { Paged } from '@/types/common.types'
import { USE_MOCKS } from './mock/useMocks'
import { getUser } from './users.service'

const EVENTS_PAGE_SIZE = 20
const RUNS_PAGE_SIZE = 20

function inDateRange(iso: string | undefined, from?: string, to?: string): boolean {
  if (!iso) return !from && !to
  if (from && iso < from) return false
  if (to && iso > `${to}T23:59:59Z`) return false
  return true
}

/** null triggeredBy = SYSTEM (scheduler); a resolution failure (deleted user, etc.) shouldn't hide the run. */
async function mapIngestionRunAudit(dto: IngestionRunAuditResponse): Promise<IngestionRun> {
  const triggeredByEmail = dto.triggeredBy
    ? await getUser(dto.triggeredBy)
        .then((u) => u.email)
        .catch(() => null)
    : null
  return {
    id: dto.id,
    cohortId: dto.cohortId,
    syncJobId: dto.syncJobId,
    workbookFilename: dto.workbookFilename,
    status: dto.status as RunStatus,
    triggerType: dto.triggerType as TriggerType,
    triggeredBy: dto.triggeredBy,
    triggeredByEmail,
    counts: {
      rowsRead: dto.rowsRead,
      committedNew: dto.committedNew,
      updated: dto.updatedCount,
      skippedInvalid: dto.skippedInvalid,
      skippedUnchanged: dto.skippedUnchanged,
      conflicts: dto.conflictsCount,
    },
    highFailure: dto.highFailureRate,
    failureRatePercent: dto.failureRatePercent,
    runAt: dto.runAt,
  }
}

function buildIngestionRunsQuery(filters: AuditFilters, page: number, size: number): string {
  const params = new URLSearchParams()
  if (filters.cohortId) params.set('cohortId', filters.cohortId)
  if (filters.status) params.set('status', filters.status)
  if (filters.instructorContactId) params.set('instructorContactId', filters.instructorContactId)
  if (filters.dateFrom) params.set('from', `${filters.dateFrom}T00:00:00Z`)
  if (filters.dateTo) params.set('to', `${filters.dateTo}T23:59:59Z`)
  params.set('page', String(page))
  params.set('size', String(size))
  return `?${params.toString()}`
}

/** GET /audit-log/ingestion-runs (D5 AC1) — cross-cohort and genuinely paginated, unlike `runs.service.listRuns`, which is scoped to one cohort. */
export async function listAuditRuns(filters: AuditFilters = {}): Promise<Paged<IngestionRun>> {
  const page = filters.page ?? 0
  const size = filters.size ?? RUNS_PAGE_SIZE
  if (USE_MOCKS) {
    const { mockDelay, runs } = await import('./mock/fixtures')
    const list = runs
      .filter(
        (r) =>
          (!filters.cohortId || r.cohortId === filters.cohortId) &&
          (!filters.status || r.status === filters.status) &&
          inDateRange(r.runAt, filters.dateFrom, filters.dateTo),
      )
      .sort((a, b) => (b.runAt ?? '').localeCompare(a.runAt ?? ''))
    const start = page * size
    // Mock data has no separate ingestion-run/sync-job distinction — the run's own id doubles as both.
    const content = list.slice(start, start + size).map((r) => ({ ...r, syncJobId: r.id }))
    return mockDelay({
      content,
      number: page,
      size,
      totalElements: list.length,
      totalPages: Math.max(1, Math.ceil(list.length / size)),
      last: start + size >= list.length,
    })
  }
  const dto = await http.get<Paged<IngestionRunAuditResponse>>(
    `/audit-log/ingestion-runs${buildIngestionRunsQuery(filters, page, size)}`,
  )
  return { ...dto, content: await Promise.all(dto.content.map(mapIngestionRunAudit)) }
}

/** null actorUserId = SYSTEM actor; a resolution failure (deleted user, etc.) shouldn't hide the event. */
async function mapAuditEvent(dto: AuditEventResponse): Promise<AuditEvent> {
  const actorEmail = dto.actorUserId
    ? await getUser(dto.actorUserId)
        .then((u) => u.email)
        .catch(() => null)
    : null
  return {
    id: dto.id,
    eventType: dto.eventType,
    cohortId: dto.cohortId,
    actorEmail,
    occurredAt: dto.occurredAt,
    payload: dto.payload ?? undefined,
  }
}

export async function listAuditEvents(filters: AuditFilters = {}): Promise<Paged<AuditEvent>> {
  const page = filters.page ?? 0
  const size = filters.size ?? EVENTS_PAGE_SIZE
  if (USE_MOCKS) {
    const { mockDelay, auditEvents } = await import('./mock/fixtures')
    const list = auditEvents
      .filter(
        (e) =>
          (!filters.cohortId || e.cohortId === filters.cohortId) &&
          (!filters.eventType || e.eventType === filters.eventType) &&
          inDateRange(e.occurredAt, filters.dateFrom, filters.dateTo),
      )
      .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''))
    const start = page * size
    const content = list.slice(start, start + size)
    return mockDelay({
      content,
      number: page,
      size,
      totalElements: list.length,
      totalPages: Math.max(1, Math.ceil(list.length / size)),
      last: start + size >= list.length,
    })
  }
  const dto = await http.get<Paged<AuditEventResponse>>(
    `/audit-log/audit-events${buildAuditEventsQuery(filters, page, size)}`,
  )
  return { ...dto, content: await Promise.all(dto.content.map(mapAuditEvent)) }
}

export async function getAuditEvent(id: string): Promise<AuditEvent> {
  if (USE_MOCKS) {
    const { mockDelay, auditEvents } = await import('./mock/fixtures')
    const e = auditEvents.find((x) => x.id === id)
    if (!e) throw new Error('Event not found')
    return mockDelay(e)
  }
  const dto = await http.get<AuditEventResponse>(`/audit-log/audit-events/${id}`)
  return mapAuditEvent(dto)
}

function buildAuditEventsQuery(filters: AuditFilters, page: number, size: number): string {
  const params = new URLSearchParams()
  if (filters.cohortId) params.set('cohortId', filters.cohortId)
  if (filters.eventType) params.set('eventType', filters.eventType)
  if (filters.dateFrom) params.set('from', `${filters.dateFrom}T00:00:00Z`)
  if (filters.dateTo) params.set('to', `${filters.dateTo}T23:59:59Z`)
  params.set('page', String(page))
  params.set('size', String(size))
  return `?${params.toString()}`
}
