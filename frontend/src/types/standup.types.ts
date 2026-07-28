// Cohort stand-up gate flow (PRD Epic A, FE strategy §6.2 / §9).
import type { LocatedError } from './common.types'
import type { ReferenceBundleSummary } from './domain.types'

/** The stepper steps shown during stand-up (§6.2). Accept is a manual checkpoint. */
export type GateId = 'gate1' | 'gate2' | 'gate3' | 'accept' | 'gate4'

/**
 * Per-step state. `not_run` = a downstream step that didn't run because an
 * earlier gate failed (fail-fast, A3 AC4 / A9 AC3).
 */
export type GateStatus = 'pending' | 'running' | 'passed' | 'failed' | 'not_run'

export interface Gate {
  id: GateId
  label: string
  status: GateStatus
  errors: LocatedError[]
}

/** Overall async-job status (terminal: passed | failed). Drives useJobPolling. */
export type StandupOverall = 'pending' | 'running' | 'passed' | 'failed'

/**
 * Shape returned by GET /cohorts/{id}/standup/status (the polled endpoint used
 * for Gate 4, §9) and assembled client-side from the Gate 1-3 SSE stream (§9b).
 * Transport-agnostic: the view depends on this shape, not on how it's fetched.
 */
export interface StandupStatus {
  overall: StandupOverall
  gates: Gate[]
  /** Present once Gate 3 passes — preview counts for the Accept summary (A6 AC1). */
  acceptSummary?: ReferenceBundleSummary
}

/** Payload to start a stand-up job (submit the SharePoint folder link, A2). */
export interface StartStandupPayload {
  sharepointFolderUrl: string
}

/** 202 response body from POST /cohorts/{id}/standup (§9b). */
export interface StandupJob {
  id: string
  cohortId: string
  status: string
  startedAt: string
}

/** Gate numbering as sent over the SSE stream — 1:1 with gate1/gate2/gate3. */
export type StreamGateNumber = 1 | 2 | 3

/** `gate.passed` event data (§9b). Fields present depend on which gate passed. */
export interface GatePassedData {
  gate: StreamGateNumber
  driveId?: string // Gate 1
  itemId?: string // Gate 1
  referenceFolderItemId?: string // Gate 2
  specs?: number // Gate 3
  modules?: number // Gate 3
  labs?: number // Gate 3
  learners?: number // Gate 3
  quizReferencePresent?: boolean // Gate 3
}

/** `gate.failed` event data (§9b). Pipeline stops at the first failing gate. */
export interface GateFailedData {
  gate: StreamGateNumber
  errors: string[]
}

/** `pipeline.done` event data (§9b) — always the last event on the stream. */
export interface PipelineDoneData {
  status: 'COMPLETED' | 'FAILED'
  specs?: number
  modules?: number
  labs?: number
  learners?: number
  quizReferencePresent?: boolean
}

/** 202 response body from POST /cohorts/{id}/gate4 (§9d). */
export interface Gate4Job {
  jobId: string
}

export type FileGateStatus = 'processing' | 'passed' | 'failed'

/** `file.processing` event data (§9d) — one file at a time, in order. */
export interface FileProcessingData {
  file: string
  scenario: string
}

/** `file.passed` event data (§9d). */
export interface FilePassedData {
  file: string
  rows: number
}

/** `file.failed` event data (§9d). */
export interface FileFailedData {
  file: string
  errors: string[]
}

/** `gate4.done` event data (§9d) — always the last event on the stream. */
export interface Gate4DoneData {
  status: 'COMPLETED' | 'FAILED'
}

/** Per-file Gate 4 result, assembled client-side from the stream events. */
export interface FileGateResult {
  file: string
  scenario?: string
  status: FileGateStatus
  rows?: number
  errors: LocatedError[]
}
