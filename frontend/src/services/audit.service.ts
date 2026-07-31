// Audit log: historical runs + lifecycle events (PRD Epic D D5, FE strategy §8).
import { http } from './http'
import type { IngestionRun } from '@/types/run.types'
import type { AuditEvent, AuditFilters } from '@/types/audit.types'
import type { Paged } from '@/types/common.types'
import { USE_MOCKS } from './mock/useMocks'

function inDateRange(iso: string | undefined, from?: string, to?: string): boolean {
  if (!iso) return !from && !to
  if (from && iso < from) return false
  if (to && iso > `${to}T23:59:59Z`) return false
  return true
}

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
  const page = await http.get<Paged<IngestionRun>>(`/audit/runs${buildQuery(filters)}`)
  return page.content
}

export async function listAuditEvents(filters: AuditFilters = {}): Promise<AuditEvent[]> {
  if (USE_MOCKS) {
    const { mockDelay, auditEvents } = await import('./mock/fixtures')
    const list = auditEvents.filter(
      (e) =>
        (!filters.cohortId || e.cohortId === filters.cohortId) &&
        inDateRange(e.occurredAt, filters.dateFrom, filters.dateTo),
    )
    return mockDelay([...list].sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '')))
  }
  const page = await http.get<Paged<AuditEvent>>(`/audit/events${buildQuery(filters)}`)
  return page.content
}

function buildQuery(filters: AuditFilters): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
