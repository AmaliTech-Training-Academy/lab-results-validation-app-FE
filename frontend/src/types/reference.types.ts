export interface Cohort {
  id: number
  name: string
  isActive: boolean
}

export interface Specialization {
  id: number
  cohortId: number
  name: string
}

export interface Module {
  id: number
  specializationId: number
  code: string
  name: string
}

export interface Lab {
  id: number
  moduleId: number
  title: string
  maxScore: number
  hasResults: boolean
}

export interface AddLabPayload {
  moduleId: number
  title: string
  maxScore: number
}

export interface ForceEditLabPayload {
  labId: number
  maxScore: number
  reason: string
}
