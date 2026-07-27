// Audit & version history (PRD Epic D, schema: audit_event + ingestion_runs).
import type { RunStatus } from './run.types'

/** schema: audit_event.event_type CHECK — cohort/stand-up lifecycle events. */
export type AuditEventType =
  | 'LINK_SUBMITTED'
  | 'GATE_FAILED'
  | 'GATE_PASSED'
  | 'REFERENCE_ACCEPTED'
  | 'DISCARD_RESET'
  | 'COHORT_LOCKED'
  | 'COHORT_UNLOCKED'
  | 'STOOD_UP'
  | 'CONFLICT_RESOLVED'

export interface AuditEvent {
  id: string
  eventType: AuditEventType
  cohortId: string | null
  cohortName?: string
  /** null = SYSTEM actor. */
  actorEmail: string | null
  occurredAt: string
  payload?: Record<string, unknown>
}

/** Filters for the historical audit-log view (D5 AC1). */
export interface AuditFilters {
  cohortId?: string
  dateFrom?: string
  dateTo?: string
  /** Runs only. */
  status?: RunStatus
  /** Runs only — filter by instructor whose rows appear in the run. */
  instructorId?: string
  page?: number
  size?: number
}
