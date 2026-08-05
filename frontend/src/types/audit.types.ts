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
  /** CohortSyncService.resolveConflict records this for a KEEP_EXISTING/KEEP_INCOMING action. Payload: `{ conflictId, action, note }`. */
  | 'CONFLICT_RESOLVED'
  /** CohortSyncService.resolveConflict records this instead of CONFLICT_RESOLVED when the action is REJECT. Same payload shape. */
  | 'CONFLICT_DISMISSED'

/** Tone per known event type, shared across the audit list and detail views. Falls back to 'info' for anything outside `AuditEventType` (the backend field isn't a closed enum on our side). */
export const EVENT_TYPE_TONE: Record<AuditEventType, 'success' | 'warning' | 'danger' | 'info'> = {
  LINK_SUBMITTED: 'info',
  GATE_FAILED: 'danger',
  GATE_PASSED: 'success',
  REFERENCE_ACCEPTED: 'success',
  DISCARD_RESET: 'warning',
  COHORT_LOCKED: 'warning',
  COHORT_UNLOCKED: 'info',
  STOOD_UP: 'success',
  CONFLICT_RESOLVED: 'info',
  CONFLICT_DISMISSED: 'warning',
}

/** Icon per known event type, shared across the audit list and detail views. Falls back to 'circle'. */
export const EVENT_TYPE_ICON: Record<AuditEventType, string> = {
  LINK_SUBMITTED: 'link',
  GATE_FAILED: 'x-circle',
  GATE_PASSED: 'check-circle-2',
  REFERENCE_ACCEPTED: 'clipboard-check',
  DISCARD_RESET: 'rotate-ccw',
  COHORT_LOCKED: 'lock',
  COHORT_UNLOCKED: 'lock-open',
  STOOD_UP: 'flag',
  CONFLICT_RESOLVED: 'git-merge',
  CONFLICT_DISMISSED: 'trash-2',
}

/** bg/fg pair per pill tone — matches the `.pill-*` colors in global.css — for coloring an icon chip alongside a tone-carrying label (VStatCard's `.stat-chip` pattern). */
export const TONE_CHIP_STYLE: Record<'success' | 'warning' | 'danger' | 'info', { background: string; color: string }> = {
  success: { background: 'var(--success-bg)', color: 'var(--success)' },
  warning: { background: 'var(--warning-bg)', color: 'var(--warning)' },
  danger: { background: 'var(--danger-bg)', color: 'var(--danger)' },
  info: { background: 'var(--info-bg)', color: 'var(--navy)' },
}

export interface AuditEvent {
  id: string
  /** Backend sends a raw string (audit_event.event_type) — may include values outside `AuditEventType`. */
  eventType: string
  cohortId: string | null
  cohortName?: string
  /** null = SYSTEM actor. */
  actorEmail: string | null
  occurredAt: string
  payload?: Record<string, unknown>
}

/** GET /audit-log/audit-events response row — backend: AuditEventResponse record. */
export interface AuditEventResponse {
  id: string
  eventType: string
  cohortId: string | null
  /** null = SYSTEM actor; resolved to an email client-side for display. */
  actorUserId: string | null
  payload: Record<string, unknown> | null
  occurredAt: string
}

/** Filters for the historical audit-log view (D5 AC1). */
export interface AuditFilters {
  cohortId?: string
  dateFrom?: string
  dateTo?: string
  /** Runs only. */
  status?: RunStatus
  /** Events only. */
  eventType?: AuditEventType
  /** Runs only — filter by instructor whose rows appear in the run. */
  instructorId?: string
  page?: number
  size?: number
}
