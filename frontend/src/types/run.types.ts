// Weekly grading ingestion runs (PRD Epic B / Epic D, schema: ingestion_runs).
import type { LocatedError } from './common.types'

/** schema: ingestion_runs.status CHECK. SKIPPED = hash short-circuit (B3/D1 AC2). */
export type RunStatus = 'processing' | 'completed' | 'partial' | 'failed' | 'skipped'

/** Pill tone for a run's status, shared across every view that renders it. */
export const RUN_STATUS_TONE: Record<RunStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  completed: 'success',
  partial: 'warning',
  failed: 'danger',
  skipped: 'info',
  processing: 'info',
}

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
  /** Only populated by the audit-log endpoint so far — the parent sync job's id, distinct from `id`, for linking into the run-review page. */
  syncJobId?: string
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
  /** Only populated by the audit-log endpoint so far — the run-level counterpart to `FileIngestionSummary.failureRatePercent`. */
  failureRatePercent?: number
  runAt?: string
  /** Some endpoints report these instead of a combined `runAt`. */
  startedAt?: string
  completedAt?: string
  /** Row-level detail from error_report_json (D5 AC2). */
  errorReport?: LocatedError[]
  /** Only populated by the overview endpoint — when the cohort's previous run finished, if one
   *  exists. Lets Run Review say "no changes since &lt;this&gt;" for a SKIPPED run. */
  previousRunCompletedAt?: string | null
}

/** Manual sync trigger (B1 AC2) — optional narrowing to a specific file within the cohort. */
export interface SyncTriggerPayload {
  fileId?: string
}

/**
 * Response from POST /cohorts/{id}/sync and POST /cohorts/sync — a trigger
 * summary (how many cohorts were kicked off/skipped), not the created run(s).
 * The caller has to re-list to see the new run rows.
 */
export interface SyncTriggerResponse {
  triggered: number
  skipped: number
  triggeredCohortIds: string[]
}

/** schema: uppercase job status as returned by POST /cohorts/{id}/sync/runs. */
export type SyncRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'SKIPPED'

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

/** backend: CohortSyncJobStatus enum — no PENDING (the job already exists by the time it's fetched by id). */
export type CohortSyncJobStatus = 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'SKIPPED'

/** GET /cohorts/{cohortId}/sync/runs/{jobId} response — backend: SyncRunResponse record. Same field set as `SyncRun`, narrower status. */
export interface SyncRunResponse {
  id: string
  cohortId: string
  status: CohortSyncJobStatus
  startedAt: string | null
  completedAt: string | null
  triggeredBy: string | null
  targetItemId: string | null
}

/** How many rejected rows in a file carried a given rule code — backend: RejectionReasonSummary record. */
export interface RejectionReasonSummary {
  rule: string
  count: number
}

/** One workbook's grading tallies within a sync run's overview — backend: FileIngestionSummary record. */
export interface FileIngestionSummary {
  workbookFilename: string
  status: string
  /** SharePoint's cTag for the version this run read — lets an admin confirm an edited file was
   *  actually re-fetched, not stale. Populated for every file, including skipped ones. */
  sharepointVersionId: string | null
  /** SharePoint's content hash for the same version — a real re-save, not just a metadata touch. */
  quickXorHash: string | null
  rowsRead: number
  committedNew: number
  updatedCount: number
  skippedInvalid: number
  skippedUnchanged: number
  conflictsCount: number
  /** Derived flag: rejected > 50% of this file's rows (§4.5, B7 AC3). */
  highFailureRate: boolean
  failureRatePercent: number
  runAt: string
  /** Per-row rejection detail from this file's errorReportJson. */
  issues: LocatedError[]
  /** `issues` rolled up by rule code, sorted by count desc. */
  rejectionReasons: RejectionReasonSummary[]
}

/** GET /cohorts/{cohortId}/sync/runs/{jobId}/overview response — backend: GradingSyncOverviewResponse record. */
export interface GradingSyncOverviewResponse {
  jobId: string
  cohortId: string
  jobStatus: CohortSyncJobStatus
  startedAt: string | null
  completedAt: string | null
  /** When the cohort's previous sync run finished, if one exists — null for a cohort's first-ever
   *  run. Lets the screen say "no changes since &lt;this&gt;" for a SKIPPED run. */
  previousRunCompletedAt: string | null
  filesProcessed: number
  rowsRead: number
  committedNew: number
  updatedCount: number
  skippedInvalid: number
  skippedUnchanged: number
  conflictsCount: number
  files: FileIngestionSummary[]
  /** Only present on single-file jobs — multi-file jobs report issues per file under `files[].issues` instead. */
  issues?: LocatedError[]
}

/**
 * Sync-run SSE stream (GET /{id}/sync/stream), emitted in order by the
 * backend's CohortSyncJobRunner: `file.discovered` for every workbook found,
 * then per file exactly one of `file.unchanged` / (`file.changed` followed by
 * `file.archived` or `file.archive_failed`) / `file.failed`, plus
 * `folder.failed` for a scenario subfolder that couldn't be listed, and
 * finally `sync.done` — always last, after which the stream closes.
 */

/** `file.discovered` — one per workbook found while scanning the cohort's SharePoint folder. */
export interface SyncFileDiscoveredData {
  file: string
  itemId: string
  versionId: string
  quickXorHash: string
}

/** `file.unchanged` — terminal for a file whose hash matched the last committed run. */
export interface SyncFileUnchangedData {
  file: string
}

/**
 * `file.changed` — a new or modified workbook, about to be archived.
 * `state`/`sheets` shapes aren't confirmed with backend yet (likely `state`
 * distinguishes NEW vs MODIFIED and `sheets` lists the sheet names touched).
 */
export interface SyncFileChangedData {
  file: string
  state: string
  sheets: string[]
}

/** `file.archived` — terminal success for a `file.changed` workbook. */
export interface SyncFileArchivedData {
  file: string
  s3Key: string
  versionId: string
  state: string
}

/** `file.failed` — terminal failure before a change/unchanged determination could be made; the backend sends whichever of `file`/`itemId` it had resolved by that point. */
export interface SyncFileFailedData {
  file?: string
  itemId?: string
  error: string
}

/** `file.archive_failed` — terminal failure archiving a `file.changed` workbook. */
export interface SyncFileArchiveFailedData {
  file: string
  error: string
}

/** `folder.failed` — a scenario subfolder couldn't be listed; not tied to a specific file. */
export interface SyncFolderFailedData {
  folder: string
  error: string
}

/** Per-file state assembled client-side from the stream events. */
export type SyncFileStatus = 'discovered' | 'unchanged' | 'changed' | 'archived' | 'failed' | 'archive_failed'

export interface SyncFileResult {
  file: string
  itemId?: string
  status: SyncFileStatus
  state?: string
  error?: string
}

/** `sync.done` — always the last event on the stream. */
export interface SyncDoneData {
  cohortName: string
  filesSeen: number
  new: number
  changed: number
  unchanged: number
  failed: number
  status: 'COMPLETED' | 'FAILED'
}
