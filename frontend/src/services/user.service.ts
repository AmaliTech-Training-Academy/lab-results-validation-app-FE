import type { InstructorUser, ModuleGroup, InstructorPayload, CreateInstructorPayload, CreatedInstructor, AssignModulesResponse, RemoveModulesResponse, PagedInstructors } from '@/types/user.types'
import { getAllSpecializations, getModules } from './reference.service'
import { http } from './http'

export async function getInstructors(page = 0, size = 10): Promise<PagedInstructors> {
  return http.get<PagedInstructors>(`/admin/users/instructors?page=${page}&size=${size}`)
}

export async function getModuleGroups(): Promise<ModuleGroup[]> {
  const specs = await getAllSpecializations()
  const groups = await Promise.all(
    specs.map(async (spec) => {
      const modules = await getModules(spec.id)
      return {
        specId: spec.id,
        specName: spec.name,
        modules: modules.map((m) => ({ id: m.id, name: m.name })),
      }
    }),
  )
  return groups.filter((g) => g.modules.length > 0)
}

export async function addInstructor(payload: CreateInstructorPayload): Promise<CreatedInstructor> {
  return http.post<CreatedInstructor>('/admin/users/instructors', payload)
}

export async function assignInstructorModules(instructorId: string, moduleIds: string[]): Promise<AssignModulesResponse> {
  return http.post<AssignModulesResponse>(`/admin/instructors/${instructorId}/modules`, { moduleIds })
}

export async function updateInstructor(instructorId: string, payload: InstructorPayload): Promise<InstructorUser> {
  return http.patch<InstructorUser>(`/admin/users/instructors/${instructorId}`, payload)
}

export async function removeInstructorModules(instructorId: string, moduleIds: string[]): Promise<RemoveModulesResponse> {
  return http.delete<RemoveModulesResponse>(`/admin/instructors/${instructorId}/modules`, { moduleIds })
}
