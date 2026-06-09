export interface AssignedModule {
  moduleId: string
  moduleName: string
  specializationName: string
}

export interface InstructorUser {
  email: string
  active: boolean
  assignedModules: AssignedModule[]
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
