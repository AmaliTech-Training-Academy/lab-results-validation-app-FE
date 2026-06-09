export interface Specialization {
  id: string
  cohortId: string
  name: string
  code: string
  createdAt: string
  updatedAt: string
}

export interface Module {
  id: string
  name: string
  sequence: number
  status: string
  cohortId: string
  cohortName: string
  specializationId: string
  specializationName: string
}

export interface Lab {
  id: string
  moduleId: string
  title: string
  maxScore: number
  hasResults: boolean
}

export interface AddLabPayload {
  moduleId: string
  title: string
  maxScore: number
}

export interface ForceEditLabPayload {
  labId: string
  maxScore: number
  reason: string
}
