// Stateful mock for the cohort stand-up pipeline (PRD Epic A). Each getStatus()
// call advances the simulation one tick, so the FE's polling loop shows gates
// progressing Pending → Running → Passed just like a real async job.
//
// Failure demo hooks (put a keyword in the folder link to exercise the error view):
//   • link contains "bad-link"       → Gate 1 fails
//   • link contains "missing-folder" → Gate 2 fails
//   • link contains "bad-ref"        → Gate 3 fails
import type { LocatedError } from '@/types/common.types'
import type { Gate, GateId, GateStatus, StandupStatus } from '@/types/standup.types'
import type { ReferenceBundleSummary } from '@/types/domain.types'
import { buildReference, cohorts, referenceByCohort } from './fixtures'

const PRE_GATES: GateId[] = ['gate1', 'gate2', 'gate3']

const LABELS: Record<GateId, string> = {
  gate1: 'Gate 1 — Link',
  gate2: 'Gate 2 — Folders',
  gate3: 'Gate 3 — Reference files',
  accept: 'Accept',
  gate4: 'Gate 4 — Empty score sheets',
}

interface JobState {
  status: Record<GateId, GateStatus>
  errors: Record<GateId, LocatedError[]>
  overall: StandupStatus['overall']
  accepted: boolean
  failAt: GateId | null
}

const jobs = new Map<string, JobState>()

function freshJob(url: string): JobState {
  let failAt: GateId | null = null
  if (url.includes('bad-link')) failAt = 'gate1'
  else if (url.includes('missing-folder')) failAt = 'gate2'
  else if (url.includes('bad-ref')) failAt = 'gate3'
  return {
    status: { gate1: 'pending', gate2: 'pending', gate3: 'pending', accept: 'pending', gate4: 'pending' },
    errors: { gate1: [], gate2: [], gate3: [], accept: [], gate4: [] },
    overall: 'pending',
    accepted: false,
    failAt,
  }
}

function sampleErrors(gate: GateId): LocatedError[] {
  switch (gate) {
    case 'gate1':
      return [{ message: 'Cannot access the SharePoint folder. Check the path and that LabGate has been granted access.' }]
    case 'gate2':
      return [{ message: 'Missing required subfolder: "scores".' }]
    case 'gate3':
      return [
        { file: 'Trainee_Database.xlsx', row: 12, rule: 'REF-DUP-EMAIL', message: 'Duplicate learner email: ama.boateng@amalitech.com' },
        { file: 'Module_Setup.xlsx', row: 5, rule: 'REF-COL', message: 'Missing required column: "code"' },
      ]
    default:
      return [{ message: 'Validation failed.' }]
  }
}

function summaryFor(cohortId: string): ReferenceBundleSummary {
  const ref = referenceByCohort[cohortId] ?? buildReference(cohortId)
  const modules = ref.specializations.flatMap((s) => s.modules)
  return {
    specializations: ref.specializations.length,
    modules: modules.length,
    labs: modules.reduce((n, m) => n + m.labs.length, 0),
    learners: ref.learners.length,
    instructors: ref.instructors.length,
  }
}

function markDownstreamNotRun(job: JobState, failed: GateId) {
  const order: GateId[] = ['gate1', 'gate2', 'gate3', 'accept', 'gate4']
  for (const g of order.slice(order.indexOf(failed) + 1)) job.status[g] = 'not_run'
}

/** Advance the simulation by one tick. */
function tick(cohortId: string, job: JobState) {
  // A pre-accept gate is currently running → resolve it.
  const running = PRE_GATES.find((g) => job.status[g] === 'running')
  if (running) {
    if (job.failAt === running) {
      job.status[running] = 'failed'
      job.errors[running] = sampleErrors(running)
      job.overall = 'failed'
      markDownstreamNotRun(job, running)
      return
    }
    job.status[running] = 'passed'
    const next = PRE_GATES[PRE_GATES.indexOf(running) + 1]
    if (next) {
      job.status[next] = 'running'
    } else {
      // Gate 3 passed — pipeline pauses for the explicit Accept (A6).
      job.overall = 'passed'
    }
    return
  }

  // Fresh job → kick off Gate 1.
  if (PRE_GATES.every((g) => job.status[g] === 'pending')) {
    job.status.gate1 = 'running'
    job.overall = 'running'
    return
  }

  // Post-accept: Gate 4 running → resolve it → STOOD_UP.
  if (job.accepted && job.status.gate4 === 'running') {
    job.status.gate4 = 'passed'
    job.overall = 'passed'
    const cohort = cohorts.find((c) => c.id === cohortId)
    if (cohort) cohort.lifecycleState = 'STOOD_UP'
  }
}

function toStatus(cohortId: string, job: JobState): StandupStatus {
  const gates: Gate[] = (['gate1', 'gate2', 'gate3', 'accept', 'gate4'] as GateId[]).map((id) => ({
    id,
    label: LABELS[id],
    status: job.status[id],
    errors: job.errors[id],
  }))
  const gate3Passed = job.status.gate3 === 'passed'
  return { overall: job.overall, gates, acceptSummary: gate3Passed ? summaryFor(cohortId) : undefined }
}

export function startStandup(cohortId: string, url: string): void {
  const cohort = cohorts.find((c) => c.id === cohortId)
  if (cohort) {
    cohort.sharepointFolderUrl = url
    cohort.lifecycleState = 'DRAFT'
  }
  jobs.set(cohortId, freshJob(url))
}

export function getStandupStatus(cohortId: string): StandupStatus {
  let job = jobs.get(cohortId)
  if (!job) {
    // No active job — reflect the cohort's persisted state (survives reload, A9 AC4).
    job = freshJob(cohorts.find((c) => c.id === cohortId)?.sharepointFolderUrl ?? '')
    jobs.set(cohortId, job)
  }
  tick(cohortId, job)
  return toStatus(cohortId, job)
}

export function acceptReference(cohortId: string): void {
  const job = jobs.get(cohortId)
  if (!job) return
  job.accepted = true
  job.status.accept = 'passed'
  job.status.gate4 = 'running'
  job.overall = 'running'
  const cohort = cohorts.find((c) => c.id === cohortId)
  if (cohort) {
    cohort.lifecycleState = 'REFERENCE_ACCEPTED'
    cohort.referenceAcceptedAt = new Date().toISOString()
    referenceByCohort[cohortId] = buildReference(cohortId)
  }
}

export function discardReference(cohortId: string): void {
  const cohort = cohorts.find((c) => c.id === cohortId)
  if (cohort) {
    cohort.lifecycleState = 'DRAFT'
    cohort.referenceAcceptedAt = null
  }
  delete referenceByCohort[cohortId]
  jobs.delete(cohortId)
}
