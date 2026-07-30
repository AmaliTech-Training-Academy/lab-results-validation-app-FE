// Weekly grading ingestion runs (PRD Epic B / Epic D, schema: ingestion_runs).
import type { LocatedError } from './common.types'

/** schema: ingestion_runs.status CHECK. SKIPPED = hash short-circuit (B3/D1 AC2). */
export type RunStatus = 'processing' | 'completed' | 'partial' | 'failed' | 'skipped'

/** schema: ingestion_runs.trigger_type CHECK. */
export type TriggerType = 'SCHEDULED' | 'MANUAL'

/** The six headline count columns (PRD §6.2 / D-2). */
export interface RunCounts {
  rowsRead: number
  committedNew: number
  updated: number
  skippedInvalid: number
  skippedUnchanged: number
  conflicts: number
}

export interface IngestionRun {
  id: string
  cohortId: string
  cohortName?: string
  workbookFilename?: string
  sharepointFileUrl?: string | null
  sharepointVersionId?: string | null
  quickXorHash?: string | null
  /** null = SYSTEM (scheduled run). */
  triggeredByEmail?: string | null
  /** Raw user id — some backend endpoints don't resolve this to an email yet. */
  triggeredBy?: string | null
  triggerType?: TriggerType
  status: RunStatus
  /** Grading tallies — not yet populated by every endpoint. */
  counts?: RunCounts
  /** Derived flag: rejected > 50% of a sheet's rows (§4.5, B7 AC3). */
  highFailure?: boolean
  runAt?: string
  /** Some endpoints report these instead of a combined `runAt`. */
  startedAt?: string
  completedAt?: string
  /** Row-level detail from error_report_json (D5 AC2). */
  errorReport?: LocatedError[]
}

/** Manual sync trigger (B1 AC2) — optional narrowing to a specific file within the cohort. */
export interface SyncTriggerPayload {
  fileId?: string
}

/** schema: uppercase job status as returned by POST /cohorts/{id}/sync/runs. */
export type SyncRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

/**
 * One row of the paged response from POST /cohorts/{id}/sync/runs (B1 AC2) —
 * a thin "job just started" stub, not the full ingestion-run detail returned
 * by GET /cohorts/{id}/standup/runs or GET /runs/{id}.
 */
export interface SyncRun {
  id: string
  cohortId: string
  status: SyncRunStatus
  startedAt?: string | null
  completedAt?: string | null
  triggeredBy?: string | null
  targetItemId?: string | null
}
