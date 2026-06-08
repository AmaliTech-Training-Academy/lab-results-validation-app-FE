export type InstructorStatus = 'active' | 'inactive'

export interface InstructorUser {
  id: number
  email: string
  assignedModuleIds: number[]
  assignedModuleCount: number
  status: InstructorStatus
}

export interface ModuleOption {
  id: number
  code: string
  name: string
}

export interface ModuleGroup {
  specId: number
  specName: string
  modules: ModuleOption[]
}

export interface InstructorPayload {
  email: string
  isActive: boolean
  assignedModuleIds: number[]
}
