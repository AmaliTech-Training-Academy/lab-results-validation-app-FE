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
  workbookFilename: string
  sharepointFileUrl: string | null
  sharepointVersionId: string | null
  quickXorHash: string | null
  /** null = SYSTEM (scheduled run). */
  triggeredByEmail: string | null
  triggerType: TriggerType
  status: RunStatus
  counts: RunCounts
  /** Derived flag: rejected > 50% of a sheet's rows (§4.5, B7 AC3). */
  highFailure: boolean
  runAt: string
  /** Row-level detail from error_report_json (D5 AC2). */
  errorReport: LocatedError[]
}

/** Manual sync trigger (B1 AC2) — optional narrowing to a cohort/file. */
export interface SyncTriggerPayload {
  cohortId?: string
  fileId?: string
}
