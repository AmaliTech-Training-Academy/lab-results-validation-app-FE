import type { CohortRow, CreateCohortPayload, CohortStatus } from '@/types/cohort.types'

// ---------------------------------------------------------------------------
// Mock data — DELETE and replace service bodies when wiring the real API
// ---------------------------------------------------------------------------

const MOCK_COHORTS: CohortRow[] = [
  { id: 4, name: 'Cohort 4', startDate: '2023-01-15', endDate: '2023-06-30', specializationCount: 3, status: 'completed' },
  { id: 5, name: 'Cohort 5', startDate: '2023-09-01', endDate: '2024-02-28', specializationCount: 3, status: 'completed' },
  { id: 6, name: 'Cohort 6 — Fall 2025', startDate: '2025-09-01', endDate: '2026-02-28', specializationCount: 2, status: 'active' },
  { id: 7, name: 'Cohort 7 — Spring 2026', startDate: '2026-03-01', endDate: '2026-08-31', specializationCount: 3, status: 'pending' },
]

let _nextId = 100

function nextId() {
  return ++_nextId
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------

export async function getCohorts(): Promise<CohortRow[]> {
  // TODO: replace with → return http.get<CohortRow[]>('/admin/cohorts')
  await delay(300)
  return MOCK_COHORTS
}

export async function createCohort(payload: CreateCohortPayload): Promise<CohortRow> {
  // TODO: replace with → return http.post<CohortRow>('/admin/cohorts', payload)
  await delay(400)
  return { id: nextId(), specializationCount: 0, ...payload }
}

export async function updateCohort(id: number, payload: CreateCohortPayload): Promise<CohortRow> {
  // TODO: replace with → return http.put<CohortRow>(`/admin/cohorts/${id}`, payload)
  await delay(400)
  return { id, specializationCount: 0, ...payload }
}

export async function setCohortStatus(_id: number, _status: CohortStatus): Promise<void> {
  // TODO: replace with → await http.patch(`/admin/cohorts/${_id}/status`, { status: _status })
  await delay(300)
}
