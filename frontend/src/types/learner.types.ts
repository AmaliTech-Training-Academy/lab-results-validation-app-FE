export type LearnerStatus = 'active' | 'archived'

export interface Learner {
  id: number
  fullName: string
  email: string
  cohortId: number
  cohortName: string
  specializationId: number
  specName: string
  status: LearnerStatus
}

export interface AddLearnerPayload {
  fullName: string
  email: string
  cohortId: number
  specializationId: number
  status: LearnerStatus
}
