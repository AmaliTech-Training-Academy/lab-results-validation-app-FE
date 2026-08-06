export type LearnerStatus = 'ACTIVE' | 'ARCHIVED'

export interface Learner {
  id: string
  fullName: string
  email: string
  cohortId: string
  cohortName: string
  specializationId: string
  specializationName: string
  status: LearnerStatus
  createdAt: string
  updatedAt: string
}

export interface PagedLearners {
  content: Learner[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface AddLearnerPayload {
  fullName: string
  email: string
  cohortId: string
  specializationId: string
  status: LearnerStatus
}

export interface LearnerFilters {
  cohortId?: string
  specializationId?: string
  status?: LearnerStatus
  search?: string
  page?: number
  size?: number
}

