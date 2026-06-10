import type { Learner, PagedLearners, AddLearnerPayload, LearnerStatus, LearnerFilters } from '@/types/learner.types'
import { http } from './http'

export async function getLearners(filters: LearnerFilters = {}): Promise<PagedLearners> {
  const params = new URLSearchParams()
  if (filters.cohortId) params.set('cohortId', filters.cohortId)
  if (filters.specializationId) params.set('specializationId', filters.specializationId)
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  if (filters.page !== undefined) params.set('page', String(filters.page))
  if (filters.size !== undefined) params.set('size', String(filters.size))
  const qs = params.toString()
  return http.get<PagedLearners>(`/admin/learners${qs ? `?${qs}` : ''}`)
}

export async function addLearner(payload: AddLearnerPayload): Promise<Learner> {
  return http.post<Learner>('/admin/learners', payload)
}

export async function updateLearner(id: string, payload: AddLearnerPayload): Promise<Learner> {
  return http.put<Learner>(`/admin/learners/${id}`, payload)
}

export async function setLearnerStatus(id: string, status: LearnerStatus): Promise<void> {
  return http.patch(`/admin/learners/${id}/status`, { status })
}
