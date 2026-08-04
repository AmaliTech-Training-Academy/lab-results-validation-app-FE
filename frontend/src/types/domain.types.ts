// LabGate v2 reference-data domain entities.
// Mirrors LabGate_v2_schema.sql. All entities below (except the cohort shell)
// arrive from the SharePoint reference bundle at stand-up and are FROZEN after
// Accept — there is no in-app create/edit for them (PRD §2, R-1).
//
// Field naming is camelCase to match the BE's JSON serialization and the
// existing FE convention.

/**
 * Cohort lifecycle (schema: cohorts.lifecycle_state CHECK).
 * LOCKED is NOT a lifecycle state — it is the orthogonal `locked` flag, only
 * meaningful once STOOD_UP. Use `cohortDisplayState()` for the UI chip.
 */
export type CohortLifecycleState = 'DRAFT' | 'REFERENCE_ACCEPTED' | 'STOOD_UP'

/** What the UI renders as a state chip (§6.1) — lifecycle + the derived LOCKED. */
export type CohortDisplayState = CohortLifecycleState | 'LOCKED'

/** Field names confirmed against the live BE response (GET /cohorts). */
export interface Cohort {
  id: string
  name: string
  startDate: string // ISO date
  endDate: string // ISO date
  lifecycleState: CohortLifecycleState
  locked: boolean
  active: boolean
  sharepointFolderUrl: string | null
  createdAt: string
  /** Not present on the live BE's list response — may only appear once populated. */
  referenceAcceptedAt?: string | null
  updatedAt?: string
}

/** Derives the display chip: LOCKED wins over the lifecycle state once applied. */
export function cohortDisplayState(c: Pick<Cohort, 'lifecycleState' | 'locked'>): CohortDisplayState {
  return c.locked && c.lifecycleState === 'STOOD_UP' ? 'LOCKED' : c.lifecycleState
}

/** Tone + label for the cohort state chip (§6.1), keyed by `cohortDisplayState()`. */
export const COHORT_STATE_CHIP: Record<CohortDisplayState, { tone: 'info' | 'warning' | 'success'; label: string }> = {
  DRAFT: { tone: 'info', label: 'Draft' },
  REFERENCE_ACCEPTED: { tone: 'warning', label: 'Reference accepted' },
  STOOD_UP: { tone: 'success', label: 'Stood up' },
  LOCKED: { tone: 'success', label: 'Locked' },
}

export interface CreateCohortPayload {
  name: string
  startDate: string
  endDate: string
}

export interface Specialization {
  id: string
  cohortId: string
  name: string
  code: string // e.g. "DA", "SWE"
}

export type ModuleStatus = 'active' | 'archived'

export interface Module {
  id: string
  specializationId: string
  name: string
  code: string // sheet-name → module lookup key, e.g. "BEM01"
  sequence: number
  status: ModuleStatus
}

export interface Lab {
  id: string
  moduleId: string
  title: string
  maxScore: number // fixed at 100 in v2 (PRD §2.2)
}

export type LearnerStatus = 'active' | 'archived'

export interface Learner {
  id: string
  learnerId: string // primary match key, e.g. "DEG-2026-001"
  fullName: string
  email: string
  cohortId: string
  specializationId: string
  status: LearnerStatus
}

/** Passwordless notification contact (schema: instructor_contacts). Never a login user. */
export interface InstructorContact {
  id: string
  instructorId: string
  email: string
  fullName: string
  active: boolean
}

// --- Committed reference hierarchy (read-only inspector, §6.3) -----------------

export interface ModuleWithLabs extends Module {
  labs: Lab[]
}

export interface SpecializationWithModules extends Specialization {
  modules: ModuleWithLabs[]
}

/** The full frozen hierarchy for a stood-up cohort, for CohortDetailView. */
export interface CohortReference {
  specializations: SpecializationWithModules[]
  learners: Learner[]
  instructors: InstructorContact[]
}

/** Counts shown on the Accept summary before commit (PRD A6 AC1). Mirrors the
 * Gate 3 stream payload (§9b), which reports quiz-reference presence rather
 * than an instructor count. */
export interface ReferenceBundleSummary {
  specializations: number
  modules: number
  labs: number
  learners: number
  quizReferencePresent: boolean
}
