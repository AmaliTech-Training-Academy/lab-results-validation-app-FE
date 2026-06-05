export type CohortStatus = 'active' | 'completed' | 'pending'

export interface CohortRow {
  id: number
  name: string
  startDate: string
  endDate: string
  specializationCount: number
  status: CohortStatus
}

export interface CreateCohortPayload {
  name: string
  startDate: string
  endDate: string
  status: CohortStatus
}
