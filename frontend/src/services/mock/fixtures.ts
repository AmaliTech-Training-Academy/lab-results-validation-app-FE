// In-memory mock backend for the v2 FE build. The real BE is greenfield and
// built in parallel (FE strategy §8) — services call these mocks while
// USE_MOCKS is on, and fall back to `http` (the real contract) when it's off.
//
// Flip USE_MOCKS to false (or set VITE_USE_MOCKS=false) once BE endpoints land.

import type {
  Cohort,
  CohortReference,
  InstructorContact,
  Lab,
  Learner,
  ModuleWithLabs,
  SpecializationWithModules,
} from '@/types/domain.types'
import type { IngestionRun } from '@/types/run.types'
import type { IngestionConflict, Notification } from '@/types/runReview.types'
import type { AuditEvent } from '@/types/audit.types'
import type { Settings } from '@/types/settings.types'
import type { SyncScheduleResponse } from '@/types/syncSchedule.types'

/** Simulated network latency so loading states are exercised. */
export function mockDelay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))
}

export function genId(prefix = 'id'): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(16).slice(2)}`
  return `${prefix}-${rand.slice(0, 8)}`
}

// ---------------------------------------------------------------------------
// Cohorts — one per lifecycle state so every UI branch has data.
// ---------------------------------------------------------------------------
export const cohorts: Cohort[] = [
  {
    id: 'coh-draft',
    name: 'Cohort 9 — Spring 2026',
    startDate: '2026-03-02',
    endDate: '2026-08-28',
    lifecycleState: 'DRAFT',
    locked: false,
    active: true,
    sharepointFolderUrl: null,
    referenceAcceptedAt: null,
    createdAt: '2026-07-20T09:00:00Z',
    updatedAt: '2026-07-20T09:00:00Z',
  },
  {
    id: 'coh-refacc',
    name: 'Cohort 8 — Winter 2026',
    startDate: '2026-01-12',
    endDate: '2026-06-26',
    lifecycleState: 'REFERENCE_ACCEPTED',
    locked: false,
    active: true,
    sharepointFolderUrl: 'https://contoso.sharepoint.com/sites/labgate/Cohort8',
    referenceAcceptedAt: '2026-07-18T14:12:00Z',
    createdAt: '2026-07-10T09:00:00Z',
    updatedAt: '2026-07-18T14:12:00Z',
  },
  {
    id: 'coh-stood',
    name: 'Cohort 7 — Autumn 2025',
    startDate: '2025-09-01',
    endDate: '2026-02-27',
    lifecycleState: 'STOOD_UP',
    locked: false,
    active: true,
    sharepointFolderUrl: 'https://contoso.sharepoint.com/sites/labgate/Cohort7',
    referenceAcceptedAt: '2025-09-03T11:00:00Z',
    createdAt: '2025-08-25T09:00:00Z',
    updatedAt: '2025-09-05T08:00:00Z',
  },
  {
    id: 'coh-locked',
    name: 'Cohort 6 — Summer 2025',
    startDate: '2025-05-05',
    endDate: '2025-10-31',
    lifecycleState: 'STOOD_UP',
    locked: true,
    active: true,
    sharepointFolderUrl: 'https://contoso.sharepoint.com/sites/labgate/Cohort6',
    referenceAcceptedAt: '2025-05-08T10:00:00Z',
    createdAt: '2025-04-28T09:00:00Z',
    updatedAt: '2025-11-01T08:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Reference hierarchy — built for stood-up cohorts.
// ---------------------------------------------------------------------------
function labsFor(moduleId: string, titles: string[]): Lab[] {
  return titles.map((title) => ({ id: genId('lab'), moduleId, title, maxScore: 100 }))
}

export function buildReference(cohortId: string): CohortReference {
  const specSwe: SpecializationWithModules = {
    id: `${cohortId}-spec-swe`,
    cohortId,
    name: 'Software Engineering',
    code: 'SWE',
    modules: [],
  }
  const specDa: SpecializationWithModules = {
    id: `${cohortId}-spec-da`,
    cohortId,
    name: 'Data Analytics',
    code: 'DA',
    modules: [],
  }

  const mkModule = (specId: string, name: string, code: string, sequence: number, labs: string[]): ModuleWithLabs => {
    const id = `${specId}-${code.toLowerCase()}`
    return { id, specializationId: specId, name, code, sequence, status: 'active', labs: labsFor(id, labs) }
  }

  specSwe.modules = [
    mkModule(specSwe.id, 'Backend I', 'BEM01', 1, ['Lab 1 — Joins', 'Lab 2 — Aggregations']),
    mkModule(specSwe.id, 'Frontend I', 'FEM01', 2, ['Lab 1 — Components', 'Lab 2 — State']),
  ]
  specDa.modules = [
    mkModule(specDa.id, 'Foundations', 'DAM01', 1, ['Lab 1 — Cleaning', 'Lab 2 — Pivots']),
  ]

  const learners: Learner[] = [
    { id: genId('lrn'), learnerId: 'DEG-2026-001', fullName: 'Ama Boateng',  email: 'ama.boateng@amalitech.com',  cohortId, specializationId: specSwe.id, status: 'active' },
    { id: genId('lrn'), learnerId: 'DEG-2026-002', fullName: 'Kofi Mensah',  email: 'kofi.mensah@amalitech.com',  cohortId, specializationId: specSwe.id, status: 'active' },
    { id: genId('lrn'), learnerId: 'DEG-2026-003', fullName: 'Yaa Asantewaa', email: 'yaa.asantewaa@amalitech.com', cohortId, specializationId: specDa.id,  status: 'active' },
    { id: genId('lrn'), learnerId: 'DEG-2026-004', fullName: 'Kwesi Appiah', email: 'kwesi.appiah@amalitech.com', cohortId, specializationId: specDa.id,  status: 'active' },
  ]

  const instructors: InstructorContact[] = [
    { id: genId('ins'), instructorId: 'INS-001', email: 'sarah.jenkins@amalitech.com', fullName: 'Sarah Jenkins', isActive: true },
    { id: genId('ins'), instructorId: 'INS-002', email: 'david.kim@amalitech.com',     fullName: 'David Kim',     isActive: true },
  ]

  return { specializations: [specSwe, specDa], learners, instructors }
}

/** Cache reference per cohort so ids stay stable across reads. */
export const referenceByCohort: Record<string, CohortReference> = {
  'coh-stood': buildReference('coh-stood'),
  'coh-locked': buildReference('coh-locked'),
}

// ---------------------------------------------------------------------------
// Ingestion runs (for the stood-up cohort).
// ---------------------------------------------------------------------------
export const runs: IngestionRun[] = [
  {
    id: 'run-001',
    cohortId: 'coh-stood',
    cohortName: 'Cohort 7 — Autumn 2025',
    workbookFilename: 'BE_Lab_Grading.xlsx',
    sharepointFileUrl: 'https://contoso.sharepoint.com/sites/labgate/Cohort7/scores/BE_Lab_Grading.xlsx',
    sharepointVersionId: '3.0',
    quickXorHash: 'abc123',
    triggeredByEmail: 'admin@amalitech.com',
    triggerType: 'MANUAL',
    status: 'completed',
    counts: { rowsRead: 42, committedNew: 38, updated: 3, skippedInvalid: 1, skippedUnchanged: 0, conflicts: 0 },
    highFailure: false,
    runAt: '2026-07-20T08:05:00Z',
    errorReport: [{ sheet: 'BEM01', row: 14, rule: 'F2', message: 'Total Score 1.2 exceeds maximum of 1.0' }],
  },
  {
    id: 'run-002',
    cohortId: 'coh-stood',
    cohortName: 'Cohort 7 — Autumn 2025',
    workbookFilename: 'FE_Lab_Grading.xlsx',
    sharepointFileUrl: 'https://contoso.sharepoint.com/sites/labgate/Cohort7/scores/FE_Lab_Grading.xlsx',
    sharepointVersionId: '5.0',
    quickXorHash: 'def456',
    triggeredByEmail: null, // SYSTEM
    triggerType: 'SCHEDULED',
    status: 'partial',
    counts: { rowsRead: 30, committedNew: 12, updated: 2, skippedInvalid: 14, skippedUnchanged: 0, conflicts: 2 },
    highFailure: true,
    runAt: '2026-07-21T08:00:00Z',
    errorReport: [
      { sheet: 'FEM01', row: 4, rule: 'R4', message: "Lab title 'State X' not configured for module FEM01" },
      { sheet: 'FEM01', row: 9, rule: 'R1', message: 'LearnerID DEG-2026-099 not found in this cohort' },
    ],
  },
  {
    id: 'run-003',
    cohortId: 'coh-stood',
    cohortName: 'Cohort 7 — Autumn 2025',
    workbookFilename: 'BE_Lab_Grading.xlsx',
    sharepointFileUrl: 'https://contoso.sharepoint.com/sites/labgate/Cohort7/scores/BE_Lab_Grading.xlsx',
    sharepointVersionId: '3.0',
    quickXorHash: 'abc123',
    triggeredByEmail: null,
    triggerType: 'SCHEDULED',
    status: 'skipped',
    counts: { rowsRead: 0, committedNew: 0, updated: 0, skippedInvalid: 0, skippedUnchanged: 42, conflicts: 0 },
    highFailure: false,
    runAt: '2026-07-28T08:00:00Z',
    errorReport: [],
  },
]

// ---------------------------------------------------------------------------
// Conflicts + notifications (for run-002).
// ---------------------------------------------------------------------------
export const conflicts: IngestionConflict[] = [
  {
    id: 'cf-001',
    ingestionRunId: 'run-002',
    cohortId: 'coh-stood',
    learnerId: 'DEG-2026-001',
    labId: 'lab-fe-state',
    conflictKind: 'in_file_duplicate',
    existingResult: { learnerId: 'DEG-2026-001', labTitle: 'Lab 2 — State', score: 80, submittedOn: '2026-07-10' },
    incomingRows: [
      { learnerId: 'DEG-2026-001', labTitle: 'Lab 2 — State', score: 90, submittedOn: '2026-07-19', instructorId: 'INS-001', sourceRef: 'FEM01!row 12' },
      { learnerId: 'DEG-2026-001', labTitle: 'Lab 2 — State', score: 85, submittedOn: '2026-07-19', instructorId: 'INS-001', sourceRef: 'FEM01!row 21' },
    ],
    status: 'PENDING',
  },
]

export const notifications: Notification[] = [
  {
    id: 'nt-001',
    ingestionRunId: 'run-002',
    cohortId: 'coh-stood',
    type: 'instructor_digest',
    recipientKind: 'instructor',
    recipientName: 'Sarah Jenkins',
    recipientEmail: 'sarah.jenkins@amalitech.com',
    dispatchPolicy: 'HELD',
    subject: 'Lab Grading Sync Report — FEM01',
    body: 'Total rows processed: 18 | Accepted: 12 | Rejected: 6',
    status: 'PENDING',
  },
  {
    id: 'nt-002',
    ingestionRunId: 'run-002',
    cohortId: 'coh-stood',
    type: 'admin_run_digest',
    recipientKind: 'admin',
    recipientName: 'All admins',
    recipientEmail: 'admins@amalitech.com',
    dispatchPolicy: 'AUTO',
    subject: 'SharePoint Grading Sync — Cohort 7',
    body: 'Run summary: 12 new, 2 updated, 14 skipped-invalid, 2 conflicts.',
    status: 'SENT',
    sentAt: '2026-07-21T08:02:00Z',
  },
  {
    id: 'nt-003',
    ingestionRunId: 'run-002',
    cohortId: 'coh-stood',
    type: 'high_failure',
    recipientKind: 'admin',
    recipientName: 'All admins',
    recipientEmail: 'admins@amalitech.com',
    dispatchPolicy: 'AUTO',
    subject: 'High-failure sheet — FE_Lab_Grading.xlsx',
    body: 'Rejected 14 of 30 rows (>50%).',
    status: 'SENT',
    sentAt: '2026-07-21T08:02:00Z',
  },
]

// ---------------------------------------------------------------------------
// Audit events.
// ---------------------------------------------------------------------------
export const auditEvents: AuditEvent[] = [
  { id: genId('ae'), eventType: 'LINK_SUBMITTED',     cohortId: 'coh-stood',  cohortName: 'Cohort 7 — Autumn 2025', actorEmail: 'admin@amalitech.com', occurredAt: '2025-09-03T10:40:00Z', payload: { link: '.../Cohort7' } },
  { id: genId('ae'), eventType: 'REFERENCE_ACCEPTED', cohortId: 'coh-stood',  cohortName: 'Cohort 7 — Autumn 2025', actorEmail: 'admin@amalitech.com', occurredAt: '2025-09-03T11:00:00Z', payload: { sharepointVersion: '1.0' } },
  { id: genId('ae'), eventType: 'STOOD_UP',           cohortId: 'coh-stood',  cohortName: 'Cohort 7 — Autumn 2025', actorEmail: null,                  occurredAt: '2025-09-03T11:05:00Z' },
  { id: genId('ae'), eventType: 'COHORT_LOCKED',      cohortId: 'coh-locked', cohortName: 'Cohort 6 — Summer 2025', actorEmail: 'admin@amalitech.com', occurredAt: '2025-11-01T08:00:00Z' },
  { id: genId('ae'), eventType: 'CONFLICT_RESOLVED',  cohortId: 'coh-stood',  cohortName: 'Cohort 7 — Autumn 2025', actorEmail: 'admin@amalitech.com', occurredAt: '2026-07-21T09:15:00Z', payload: { conflictId: 'cf-000' } },
]

// ---------------------------------------------------------------------------
// Settings.
// ---------------------------------------------------------------------------
export const settings: Settings = {
  autoSendInstructorEmails: false,
}

// ---------------------------------------------------------------------------
// Sync schedules.
// ---------------------------------------------------------------------------
export const syncSchedules: SyncScheduleResponse[] = [
  {
    id: 'sched-daily-all',
    name: 'Nightly sync — all cohorts',
    cohortId: null,
    frequency: 'DAILY',
    timeOfDay: '02:00',
    dayOfWeek: null,
    timezone: 'Africa/Accra',
    enabled: true,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'sched-weekly-coh',
    name: 'Weekly sync — Cohort 7',
    cohortId: 'coh-stood',
    frequency: 'WEEKLY',
    timeOfDay: '08:00',
    dayOfWeek: 'MONDAY',
    timezone: 'GMT',
    enabled: true,
    createdAt: '2026-06-05T00:00:00Z',
    updatedAt: '2026-06-05T00:00:00Z',
  },
  {
    id: 'sched-weekly-disabled',
    name: 'Weekly sync — Cohort 6 (paused)',
    cohortId: 'coh-locked',
    frequency: 'WEEKLY',
    timeOfDay: '18:30',
    dayOfWeek: 'FRIDAY',
    timezone: 'UTC',
    enabled: false,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
  },
]
