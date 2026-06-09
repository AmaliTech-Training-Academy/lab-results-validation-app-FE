import type { InstructorUser, ModuleGroup, InstructorPayload } from '@/types/user.types'
import { http } from './http'

export async function getInstructors(): Promise<InstructorUser[]> {
  return http.get<InstructorUser[]>('/admin/users/instructors')
}

// ── Module groups & mutations — still mock until those endpoints are defined ──

const MOCK_MODULE_GROUPS: ModuleGroup[] = [
  {
    specId: 1,
    specName: 'Data Analytics',
    modules: [
      { id: 1, code: 'DA-01', name: 'Python Fundamentals' },
      { id: 2, code: 'DA-02', name: 'Data Wrangling' },
      { id: 3, code: 'DA-03', name: 'SQL & Databases' },
      { id: 4, code: 'DA-04', name: 'Visualisation' },
    ],
  },
  {
    specId: 2,
    specName: 'Software Engineering',
    modules: [
      { id: 5, code: 'SE-01', name: 'JavaScript Fundamentals' },
      { id: 6, code: 'SE-02', name: 'React & State Management' },
      { id: 7, code: 'SE-03', name: 'Node.js & REST APIs' },
    ],
  },
  {
    specId: 3,
    specName: 'Cloud & DevOps',
    modules: [
      { id: 8, code: 'CD-01', name: 'Linux & Shell Scripting' },
      { id: 9, code: 'CD-02', name: 'Docker & Containers' },
    ],
  },
]

export async function getModuleGroups(): Promise<ModuleGroup[]> {
  // TODO: replace with → return http.get<ModuleGroup[]>('/admin/modules/groups')
  return MOCK_MODULE_GROUPS
}

export async function addInstructor(payload: InstructorPayload): Promise<InstructorUser> {
  // TODO: replace with → return http.post<InstructorUser>('/admin/users', payload)
  return {
    email: payload.email,
    active: payload.isActive,
    assignedModules: [],
  }
}

export async function updateInstructor(email: string, payload: InstructorPayload): Promise<InstructorUser> {
  // TODO: replace with → return http.put<InstructorUser>(`/admin/users/${encodeURIComponent(email)}`, payload)
  return {
    email,
    active: payload.isActive,
    assignedModules: [],
  }
}
