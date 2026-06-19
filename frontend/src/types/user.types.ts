export interface AssignedModule {
  moduleId: string
  moduleName: string
  specializationName: string
}

export interface InstructorUser {
  id: string
  email: string
  active: boolean
  assignedModules: AssignedModule[]
}

export interface ModuleOption {
  id: string
  name: string
}

export interface ModuleGroup {
  specId: string
  specName: string
  modules: ModuleOption[]
}

export interface CreateInstructorPayload {
  email: string
  isActive: boolean
}

export interface CreatedInstructor {
  id: string
  email: string
}

export interface AssignModulesResponse {
  instructorId: string
  instructorEmail: string
  assignedModules: AssignedModule[]
}

export interface InstructorPayload {
  email: string
  isActive: boolean
}

export interface RemoveModulesResponse {
  instructorId: string
  removedModuleIds: string[]
}

export interface PagedInstructors {
  content: InstructorUser[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}
