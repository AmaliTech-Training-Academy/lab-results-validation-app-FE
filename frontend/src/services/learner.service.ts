import type { Learner, AddLearnerPayload, LearnerStatus } from '@/types/learner.types'

// ---------------------------------------------------------------------------
// Mock data — DELETE and replace service bodies when wiring the real API
// ---------------------------------------------------------------------------

const MOCK_LEARNERS: Learner[] = [
  { id: 1, fullName: 'Abena Mensah', email: 'a.mensah@amalitechtraining.org', cohortId: 7, cohortName: 'Cohort 7 — Spring 2026', specializationId: 1, specName: 'Data Analytics', status: 'active' },
  { id: 2, fullName: 'Kwame Asante', email: 'k.asante@amalitechtraining.org', cohortId: 7, cohortName: 'Cohort 7 — Spring 2026', specializationId: 2, specName: 'Software Engineering', status: 'active' },
  { id: 3, fullName: 'Ama Boateng', email: 'a.boateng@amalitechtraining.org', cohortId: 7, cohortName: 'Cohort 7 — Spring 2026', specializationId: 1, specName: 'Data Analytics', status: 'active' },
  { id: 4, fullName: 'Kofi Frimpong', email: 'k.frimpong@amalitechtraining.org', cohortId: 6, cohortName: 'Cohort 6 — Fall 2025', specializationId: 4, specName: 'Data Analytics', status: 'active' },
  { id: 5, fullName: 'Efua Darko', email: 'e.darko@amalitechtraining.org', cohortId: 6, cohortName: 'Cohort 6 — Fall 2025', specializationId: 5, specName: 'Software Engineering', status: 'archived' },
  { id: 6, fullName: 'Yaw Oppong', email: 'y.oppong@amalitechtraining.org', cohortId: 7, cohortName: 'Cohort 7 — Spring 2026', specializationId: 3, specName: 'Cloud & DevOps', status: 'active' },
]

let _nextId = 100

function nextId() {
  return ++_nextId
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------

export async function getLearners(): Promise<Learner[]> {
  // TODO: replace with → return http.get<Learner[]>('/admin/learners')
  await delay(300)
  return MOCK_LEARNERS
}

export async function addLearner(payload: AddLearnerPayload, cohortName: string, specName: string): Promise<Learner> {
  // TODO: replace with → return http.post<Learner>('/admin/learners', payload)
  await delay(400)
  return { id: nextId(), cohortName, specName, ...payload }
}

export async function updateLearner(id: number, payload: AddLearnerPayload, cohortName: string, specName: string): Promise<Learner> {
  // TODO: replace with → return http.put<Learner>(`/admin/learners/${id}`, payload)
  await delay(400)
  return { id, cohortName, specName, ...payload }
}

export async function setLearnerStatus(_id: number, _status: LearnerStatus): Promise<void> {
  // TODO: replace with → await http.patch(`/admin/learners/${_id}/status`, { status: _status })
  await delay(300)
}
