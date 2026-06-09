import type { CohortRow, CreateCohortPayload, PagedCohorts } from '@/types/cohort.types'
import { http } from './http'

export async function getCohorts(page = 0, size = 10): Promise<PagedCohorts> {
  return http.get<PagedCohorts>(`/admin/cohorts?page=${page}&size=${size}`)
}

export async function createCohort(payload: CreateCohortPayload): Promise<CohortRow> {
  return http.post<CohortRow>('/admin/cohorts', payload)
}

export async function updateCohort(id: string, payload: CreateCohortPayload): Promise<CohortRow> {
  return http.put<CohortRow>(`/admin/cohorts/${id}`, payload)
}

export async function toggleCohortActive(id: string, active: boolean): Promise<void> {
  return http.patch(`/admin/cohorts/${id}/status`, { active })
}
