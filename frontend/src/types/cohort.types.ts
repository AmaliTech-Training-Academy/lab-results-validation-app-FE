export interface CohortRow {
  id: string
  name: string
  startDate: string
  endDate: string
  active: boolean
  locked: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCohortPayload {
  name: string
  startDate: string
  endDate: string
}

export type UpdateCohortPayload = Partial<{
  name: string
  startDate: string
  endDate: string
  active: boolean
}>

export interface PagedCohorts {
  content: CohortRow[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}
