// Run-Review screen: results + conflict queue + staged notifications
// (PRD Epic B B10, Epic C, FE strategy §6.5). Schema: ingestion_conflicts, notifications.
import type { FileIngestionSummary, IngestionRun } from './run.types'

/** A single graded-row value, used for the GitHub-merge-style conflict view. */
export interface LabResultValue {
  learnerId: string
  labTitle: string
  score: number
  submittedOn: string // ISO date
  instructorId?: string
  /** Where the incoming row came from (sheet + row), for the merge display. */
  sourceRef?: string
}

export type ConflictKind = 'in_file_duplicate' // schema: only kind in v2
export type ConflictStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED'

export interface IngestionConflict {
  id: string
  ingestionRunId: string
  cohortId: string
  learnerId?: string
  labId?: string
  conflictKind: ConflictKind
  /** The already-committed record, if any (may be null for a pure in-file dup). */
  existingResult: LabResultValue | null
  /** The ≥2 conflicting incoming rows held for manual resolution (§4.3). */
  incomingRows: LabResultValue[]
  status: ConflictStatus
  resolutionNote?: string
}

/** Mirrors backend enum ConflictResolutionAction. */
export type ConflictResolutionAction = 'KEEP_EXISTING' | 'KEEP_INCOMING' | 'REJECT'

/** Body for PATCH /cohorts/{id}/conflicts/{conflictId}/resolve. */
export interface ResolveConflictPayload {
  action: ConflictResolutionAction
  note?: string
}

/** Pill tone for a conflict's status, shared across every view that renders it. */
export const CONFLICT_STATUS_TONE: Record<ConflictStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  RESOLVED: 'success',
  DISMISSED: 'info',
}

/**
 * GET /cohorts/{id}/sync/runs/{jobId}/conflicts response row — backend: IngestionConflictResponse
 * record (B10). This is the raw/normalized shape straight off the
 * ingestion_conflicts table — unlike `IngestionConflict` above, it has no
 * denormalized row values (`existingResultId` is just an id, `incomingPayload`
 * is the raw column map), plus the resolution audit fields.
 */
export interface IngestionConflictResponse {
  id: string
  ingestionRunId: string
  cohortId: string
  learnerId: string | null
  labId: string | null
  conflictKind: ConflictKind
  existingResultId: string | null
  incomingPayload: Record<string, unknown>
  status: ConflictStatus
  resolvedBy: string | null
  resolvedAt: string | null
  resolutionNote: string | null
  createdAt: string
  updatedAt: string
}

/** Filters for GET /cohorts/{id}/sync/runs/{jobId}/conflicts. */
export interface ConflictListFilters {
  status?: ConflictStatus
  page?: number
  size?: number
}

// --- Notifications (staged outbox + moderation, Epic C) -----------------------

/** schema: notifications.type CHECK. */
export type NotificationType =
  | 'instructor_digest'
  | 'admin_run_digest'
  | 'standup_failure'
  | 'high_failure'
  | 'conflict_alert'
  | 'stood_up'

export type RecipientKind = 'instructor' | 'admin'
export type DispatchPolicy = 'AUTO' | 'HELD'
export type NotificationStatus = 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED'

export interface Notification {
  id: string
  ingestionRunId: string | null
  cohortId: string | null
  type: NotificationType
  recipientKind: RecipientKind
  recipientName?: string
  recipientEmail?: string
  dispatchPolicy: DispatchPolicy
  subject?: string
  body?: string
  status: NotificationStatus
  errorDetail?: string
  sentAt?: string | null
}

/** The unified Run-Review payload (§6.5): results + conflicts + notifications. */
export interface RunReview {
  run: IngestionRun
  /** Per-workbook breakdown from the overview endpoint — absent for mock data. */
  files?: FileIngestionSummary[]
  conflicts: IngestionConflict[]
  notifications: Notification[]
}
