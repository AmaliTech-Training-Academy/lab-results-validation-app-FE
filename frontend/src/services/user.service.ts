import type { InstructorUser, ModuleGroup, InstructorPayload, CreateInstructorPayload, CreatedInstructor, AssignModulesResponse, RemoveModulesResponse, PagedInstructors } from '@/types/user.types'
import { getAllSpecializations, getModules } from './reference.service'
import { http, invalidateCache } from './http'

export async function getInstructors(page = 0, size = 10): Promise<PagedInstructors> {
  return http.get<PagedInstructors>(`/admin/users/instructors?page=${page}&size=${size}`, { ttl: 15_000 })
}

export async function getModuleGroups(): Promise<ModuleGroup[]> {
  const specs = await getAllSpecializations()
  const groups = await Promise.all(
    specs.map(async (spec) => {
      const { content: modules } = await getModules(spec.id, 0, 1000)
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
  const created = await http.post<CreatedInstructor>('/admin/users/instructors', payload)
  invalidateCache('/admin/users/instructors')
  return created
}

export async function assignInstructorModules(instructorId: string, moduleIds: string[]): Promise<AssignModulesResponse> {
  const result = await http.post<AssignModulesResponse>(`/admin/instructors/${instructorId}/modules`, { moduleIds })
  invalidateCache(`/admin/instructors/${instructorId}/modules`)
  return result
}

export async function updateInstructor(instructorId: string, payload: InstructorPayload): Promise<InstructorUser> {
  const updated = await http.patch<InstructorUser>(`/admin/users/instructors/${instructorId}`, payload)
  invalidateCache('/admin/users/instructors')
  return updated
}

export async function removeInstructorModules(instructorId: string, moduleIds: string[]): Promise<RemoveModulesResponse> {
  const result = await http.delete<RemoveModulesResponse>(`/admin/instructors/${instructorId}/modules`, { moduleIds })
  invalidateCache(`/admin/instructors/${instructorId}/modules`)
  return result
}
