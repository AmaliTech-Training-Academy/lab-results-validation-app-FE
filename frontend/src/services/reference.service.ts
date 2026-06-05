import type {
  Cohort,
  Specialization,
  Module,
  Lab,
  AddLabPayload,
  ForceEditLabPayload,
} from '@/types/reference.types'

// ---------------------------------------------------------------------------
// Mock data — DELETE and replace service bodies when wiring the real API
// ---------------------------------------------------------------------------

const MOCK_COHORTS: Cohort[] = [
  { id: 7, name: 'Cohort 7 — Spring 2026', isActive: true },
  { id: 6, name: 'Cohort 6 — Fall 2025', isActive: false },
]

const MOCK_SPECS: Record<number, Specialization[]> = {
  7: [
    { id: 1, cohortId: 7, name: 'Data Analytics' },
    { id: 2, cohortId: 7, name: 'Software Engineering' },
    { id: 3, cohortId: 7, name: 'Cloud & DevOps' },
  ],
  6: [
    { id: 4, cohortId: 6, name: 'Data Analytics' },
    { id: 5, cohortId: 6, name: 'Software Engineering' },
  ],
}

const MOCK_MODULES: Record<number, Module[]> = {
  1: [
    { id: 1, specializationId: 1, code: 'DA-01', name: 'Python Fundamentals' },
    { id: 2, specializationId: 1, code: 'DA-02', name: 'Data Wrangling' },
    { id: 3, specializationId: 1, code: 'DA-03', name: 'SQL & Databases' },
    { id: 4, specializationId: 1, code: 'DA-04', name: 'Visualisation' },
  ],
  2: [
    { id: 5, specializationId: 2, code: 'SE-01', name: 'JavaScript Fundamentals' },
    { id: 6, specializationId: 2, code: 'SE-02', name: 'React & State Management' },
    { id: 7, specializationId: 2, code: 'SE-03', name: 'Node.js & REST APIs' },
  ],
  3: [
    { id: 8, specializationId: 3, code: 'CD-01', name: 'Linux & Shell Scripting' },
    { id: 9, specializationId: 3, code: 'CD-02', name: 'Docker & Containers' },
  ],
  4: [
    { id: 10, specializationId: 4, code: 'DA-01', name: 'Python Fundamentals' },
    { id: 11, specializationId: 4, code: 'DA-02', name: 'Data Wrangling' },
  ],
  5: [
    { id: 12, specializationId: 5, code: 'SE-01', name: 'JavaScript Fundamentals' },
  ],
}

const MOCK_LABS: Record<number, Lab[]> = {
  1: [
    { id: 1, moduleId: 1, title: 'Lab 1 — Intro to Python', maxScore: 100, hasResults: true },
    { id: 2, moduleId: 1, title: 'Lab 2 — Functions & Loops', maxScore: 80, hasResults: true },
    { id: 3, moduleId: 1, title: 'Lab 3 — OOP Basics', maxScore: 80, hasResults: false },
  ],
  2: [
    { id: 4, moduleId: 2, title: 'Lab 1 — Pandas Basics', maxScore: 100, hasResults: true },
    { id: 5, moduleId: 2, title: 'Lab 2 — Data Cleaning', maxScore: 80, hasResults: false },
  ],
  3: [
    { id: 6, moduleId: 3, title: 'Lab 1 — SELECT Queries', maxScore: 100, hasResults: false },
  ],
  5: [
    { id: 7, moduleId: 5, title: 'Lab 1 — Variables & Types', maxScore: 100, hasResults: true },
    { id: 8, moduleId: 5, title: 'Lab 2 — ES6 Features', maxScore: 80, hasResults: false },
  ],
}

let _nextId = 1000

function nextId() {
  return ++_nextId
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------

export async function getCohorts(): Promise<Cohort[]> {
  // TODO: replace with → return http.get<Cohort[]>('/admin/cohorts')
  await delay(200)
  return MOCK_COHORTS
}

export async function getSpecializations(cohortId: number): Promise<Specialization[]> {
  // TODO: replace with → return http.get<Specialization[]>(`/admin/cohorts/${cohortId}/specializations`)
  await delay(250)
  return MOCK_SPECS[cohortId] ?? []
}

export async function getModules(specializationId: number): Promise<Module[]> {
  // TODO: replace with → return http.get<Module[]>(`/admin/specializations/${specializationId}/modules`)
  await delay(250)
  return MOCK_MODULES[specializationId] ?? []
}

export async function getLabs(moduleId: number): Promise<Lab[]> {
  // TODO: replace with → return http.get<Lab[]>(`/admin/modules/${moduleId}/labs`)
  await delay(250)
  return MOCK_LABS[moduleId] ?? []
}

export async function addSpecialization(cohortId: number, name: string): Promise<Specialization> {
  // TODO: replace with → return http.post<Specialization>(`/admin/cohorts/${cohortId}/specializations`, { name })
  await delay(400)
  return { id: nextId(), cohortId, name }
}

export async function addModule(specializationId: number, name: string, code: string): Promise<Module> {
  // TODO: replace with → return http.post<Module>(`/admin/specializations/${specializationId}/modules`, { name, code })
  await delay(400)
  return { id: nextId(), specializationId, code, name }
}

export async function addLab(payload: AddLabPayload): Promise<Lab> {
  // TODO: replace with → return http.post<Lab>(`/admin/modules/${payload.moduleId}/labs`, payload)
  await delay(400)
  return { id: nextId(), moduleId: payload.moduleId, title: payload.title, maxScore: payload.maxScore, hasResults: false }
}

export async function updateLab(_labId: number, _title: string, _maxScore: number): Promise<void> {
  // TODO: replace with → await http.put(`/admin/labs/${_labId}`, { title: _title, maxScore: _maxScore })
  await delay(400)
}

export async function forceEditLab(_payload: ForceEditLabPayload): Promise<void> {
  // TODO: replace with → await http.patch(`/admin/labs/${_payload.labId}/force-edit`, { maxScore: _payload.maxScore, reason: _payload.reason })
  await delay(400)
}
