// Audit log: historical runs + lifecycle events (PRD Epic D D5, FE strategy §8).
import { http } from './http'
import type { IngestionRun } from '@/types/run.types'
import type { AuditEvent, AuditEventResponse, AuditFilters } from '@/types/audit.types'
import type { Paged } from '@/types/common.types'
import { USE_MOCKS } from './mock/useMocks'
import { listRuns as listGradingRuns } from './runs.service'
import { listCohorts } from './cohorts.service'
import { getUser } from './users.service'

const EVENTS_PAGE_SIZE = 20

function inDateRange(iso: string | undefined, from?: string, to?: string): boolean {
  if (!iso) return !from && !to
  if (from && iso < from) return false
  if (to && iso > `${to}T23:59:59Z`) return false
  return true
}

/**
 * There's no cross-cohort ingestion-runs endpoint — GET /cohorts/{id}/sync/runs (the same
 * grading-runs listing `runs.service.listRuns` wraps) is scoped to one cohort. With a cohort
 * filter, list just that one; with "All", fan out over every stood-up cohort and merge, same
 * as `useRunsStore.fetchList` does for the Grading runs page.
 */
export async function listAuditRuns(filters: AuditFilters = {}): Promise<IngestionRun[]> {
  if (USE_MOCKS) {
    const { mockDelay, runs } = await import('./mock/fixtures')
    const list = runs.filter(
      (r) =>
        (!filters.cohortId || r.cohortId === filters.cohortId) &&
        (!filters.status || r.status === filters.status) &&
        inDateRange(r.runAt, filters.dateFrom, filters.dateTo),
    )
    return mockDelay([...list].sort((a, b) => (b.runAt ?? '').localeCompare(a.runAt ?? '')))
  }
  const runList = filters.cohortId
    ? await listGradingRuns(filters.cohortId)
    : (
        await Promise.all(
          (await listCohorts()).filter((c) => c.lifecycleState === 'STOOD_UP').map((c) => listGradingRuns(c.id)),
        )
      ).flat()
  return runList
    .filter((r) => (!filters.status || r.status === filters.status) && inDateRange(r.runAt, filters.dateFrom, filters.dateTo))
    .sort((a, b) => (b.runAt ?? b.startedAt ?? '').localeCompare(a.runAt ?? a.startedAt ?? ''))
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
