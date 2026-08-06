// Run-Review screen: results + conflict queue + staged notifications
// (PRD Epic B B10, Epic C, FE strategy §6.5). Schema: ingestion_conflicts, notifications.
import type { FileIngestionSummary, IngestionRun } from './run.types'
import type { LocatedError } from './common.types'

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
  /** Only present on the real /notifications listing — same value as the run/jobId elsewhere in this app. */
  syncJobId?: string | null
  type: NotificationType
  recipientKind: RecipientKind
  /** Denormalized display fields — mock data sets these directly; for real data they're filled in by resolving `recipientInstructorId` via GET /instructors/{id}. */
  recipientName?: string
  recipientEmail?: string
  recipientInstructorId?: string | null
  recipientUserId?: string | null
  dispatchPolicy: DispatchPolicy
  subject?: string
  body?: string
  status: NotificationStatus
  errorDetail?: string
  sentAt?: string | null
  dismissedBy?: string | null
  dismissedAt?: string | null
  createdAt?: string
  /** The specific rejected rows that triggered this notification (e.g. unknown-reviewer alerts). */
  issues: LocatedError[]
}

/** GET /notifications response row — backend: NotificationResponse record. */
export interface NotificationResponse {
  id: string
  cohortId: string | null
  syncJobId: string | null
  ingestionRunId: string | null
  type: string
  recipientKind: string
  recipientInstructorId: string | null
  recipientUserId: string | null
  dispatchPolicy: string
  subject: string | null
  status: string
  errorDetail: string | null
  sentAt: string | null
  dismissedBy: string | null
  dismissedAt: string | null
  createdAt: string
  issues: LocatedError[]
}

/** Filters for GET /notifications — all optional, narrow the paginated list. */
export interface NotificationListFilters {
  cohortId?: string
  syncJobId?: string
  status?: NotificationStatus
  type?: NotificationType
  recipientKind?: RecipientKind
  page?: number
  size?: number
}

/** The unified Run-Review payload (§6.5): results + conflicts + notifications. */
export interface RunReview {
  run: IngestionRun
  /** Per-workbook breakdown from the overview endpoint — absent for mock data. */
  files?: FileIngestionSummary[]
  conflicts: IngestionConflict[]
  /** Speculative merge-view list — dead for real data (see `notificationsPage` in the store), kept for mock compatibility. */
  notifications: Notification[]
}
