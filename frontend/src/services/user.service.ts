import type { InstructorUser, ModuleGroup, InstructorPayload } from '@/types/user.types'

// ---------------------------------------------------------------------------
// Mock data — DELETE and replace service bodies when wiring the real API
// ---------------------------------------------------------------------------

const MOCK_INSTRUCTORS: InstructorUser[] = [
  { id: 1, email: 's.jenkins@amalitechtraining.org', assignedModuleIds: [1, 2, 5, 6], assignedModuleCount: 4, status: 'active' },
  { id: 2, email: 'm.chen@amalitechtraining.org', assignedModuleIds: [3, 4], assignedModuleCount: 2, status: 'active' },
  { id: 3, email: 'a.patel@amalitechtraining.org', assignedModuleIds: [7, 8, 9], assignedModuleCount: 3, status: 'active' },
  { id: 4, email: 'j.wilson@amalitechtraining.org', assignedModuleIds: [], assignedModuleCount: 0, status: 'inactive' },
]

// Module IDs match those in reference.service.ts (active cohort 7)
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

let _nextId = 100

function nextId() {
  return ++_nextId
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------

export async function getInstructors(): Promise<InstructorUser[]> {
  // TODO: replace with → return http.get<InstructorUser[]>('/admin/users?role=instructor')
  await delay(300)
  return [...MOCK_INSTRUCTORS]
}

export async function getModuleGroups(): Promise<ModuleGroup[]> {
  // TODO: replace with → return http.get<ModuleGroup[]>('/admin/modules/groups')
  await delay(250)
  return MOCK_MODULE_GROUPS
}

export async function addInstructor(payload: InstructorPayload): Promise<InstructorUser> {
  // TODO: replace with → return http.post<InstructorUser>('/admin/users', payload)
  await delay(500)
  const user: InstructorUser = {
    id: nextId(),
    email: payload.email,
    assignedModuleIds: payload.assignedModuleIds,
    assignedModuleCount: payload.assignedModuleIds.length,
    status: payload.isActive ? 'active' : 'inactive',
  }
  MOCK_INSTRUCTORS.push(user)
  return user
}

export async function updateInstructor(id: number, payload: InstructorPayload): Promise<InstructorUser> {
  // TODO: replace with → return http.put<InstructorUser>(`/admin/users/${id}`, payload)
  await delay(500)
  const idx = MOCK_INSTRUCTORS.findIndex((u) => u.id === id)
  if (idx !== -1) {
    MOCK_INSTRUCTORS[idx]!.assignedModuleIds = payload.assignedModuleIds
    MOCK_INSTRUCTORS[idx]!.assignedModuleCount = payload.assignedModuleIds.length
    MOCK_INSTRUCTORS[idx]!.status = payload.isActive ? 'active' : 'inactive'
  }
  return MOCK_INSTRUCTORS[idx]!
}
