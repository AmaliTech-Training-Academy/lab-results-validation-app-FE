// Audit log: historical runs + lifecycle events (PRD Epic D D5, FE strategy §8).
import { http } from './http'
import type { IngestionRun } from '@/types/run.types'
import type { AuditEvent, AuditFilters } from '@/types/audit.types'
import { USE_MOCKS, mockDelay, runs, auditEvents } from './mock/fixtures'

function inDateRange(iso: string, from?: string, to?: string): boolean {
  if (from && iso < from) return false
  if (to && iso > `${to}T23:59:59Z`) return false
  return true
}

export async function listAuditRuns(filters: AuditFilters = {}): Promise<IngestionRun[]> {
  if (USE_MOCKS) {
    const list = runs.filter(
      (r) =>
        (!filters.cohortId || r.cohortId === filters.cohortId) &&
        (!filters.status || r.status === filters.status) &&
        inDateRange(r.runAt, filters.dateFrom, filters.dateTo),
    )
    return mockDelay([...list].sort((a, b) => b.runAt.localeCompare(a.runAt)))
  }
  return http.get<IngestionRun[]>(`/audit/runs${buildQuery(filters)}`)
}

export async function listAuditEvents(filters: AuditFilters = {}): Promise<AuditEvent[]> {
  if (USE_MOCKS) {
    const list = auditEvents.filter(
      (e) =>
        (!filters.cohortId || e.cohortId === filters.cohortId) &&
        inDateRange(e.occurredAt, filters.dateFrom, filters.dateTo),
    )
    return mockDelay([...list].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)))
  }
  return http.get<AuditEvent[]>(`/audit/events${buildQuery(filters)}`)
}

function buildQuery(filters: AuditFilters): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
