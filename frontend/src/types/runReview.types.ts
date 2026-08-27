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
  /**
   * The 0-based `ConflictCandidate.index` the admin picked. Required for KEEP_INCOMING whenever the
   * conflict holds more than one candidate — the backend has no other way to know which of the ≥2
   * conflicting incoming rows should become authoritative. May be omitted only when the conflict holds
   * exactly one candidate (auto-selected server-side). Ignored for KEEP_EXISTING/REJECT.
   */
  chosenRowIndex?: number
  note?: string
}

/** Pill tone for a conflict's status, shared across every view that renders it. */
export const CONFLICT_STATUS_TONE: Record<ConflictStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  RESOLVED: 'success',
  DISMISSED: 'info',
}

/**
 * One conflicting incoming row held for manual resolution — one duplicate = one conflict with N
 * candidates (post the "hold a duplicated row as one conflict with one decision" fix), each candidate
 * being a spreadsheet row that disagreed with the others. `index` is the value `ResolveConflictPayload
 * .chosenRowIndex` must reference to pick this candidate for KEEP_INCOMING.
 */
export interface ConflictCandidate {
  index: number
  fileName: string
  sheetName: string
  rowNum: number | null
  nspName: string | null
  score: number | null
  submittedOn: string | null // ISO date
  instructorContactId: string | null
  reviewerName: string | null
  /** False for a corrupt/incomplete row (e.g. missing score or submittedOn) — not committable, so KEEP_INCOMING on it is rejected server-side. */
  payloadIntact: boolean
}

/** The already-committed row a conflict's candidates are competing against, if one exists yet. */
export interface ExistingResultView {
  id: string
  score: number
  submittedOn: string // ISO date
  instructorContactId: string | null
  reviewerName: string | null
}

/**
 * GET /cohorts/{id}/sync/runs/{jobId}/conflicts response row — backend: IngestionConflictResponse
 * record (B10, post duplicate-conflict-grouping rework). `learnerName`/`labTitle`/`existingResult`/
 * each candidate's `reviewerName` are denormalized server-side by IngestionConflictViewAssembler —
 * always populated on the real HTTP response (may be null if the underlying learner/instructor record
 * is gone). `incomingPayload` is the raw verbatim column map kept for a "raw JSON" debug view — prefer
 * `candidates` for display.
 */
export interface IngestionConflictResponse {
  id: string
  ingestionRunId: string
  cohortId: string
  learnerId: string | null
  learnerName: string | null
  labId: string | null
  labTitle: string | null
  conflictKind: ConflictKind
  existingResultId: string | null
  existingResult: ExistingResultView | null
  /** The ≥1 conflicting incoming rows held for manual resolution — pick one via `ResolveConflictPayload.chosenRowIndex`. */
  candidates: ConflictCandidate[]
  incomingPayload: Record<string, unknown>
  /** Human-readable pointer to where the duplicate physically lives in the sheet, for the admin. */
  remediation: string | null
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
