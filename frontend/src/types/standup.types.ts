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
 * Shape returned by GET /cohorts/{id}/standup/status (the polled endpoint, §9).
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
