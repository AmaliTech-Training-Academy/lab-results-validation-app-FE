import type { InstructorUser, ModuleGroup, InstructorPayload, CreateInstructorPayload, CreatedInstructor, AssignModulesResponse, RemoveModulesResponse, PagedInstructors, InstructorFilters } from '@/types/user.types'
import { getAllSpecializations, getModules } from './reference.service'
import { http } from './http'

export async function getInstructors(filters: InstructorFilters = {}): Promise<PagedInstructors> {
  const params = new URLSearchParams()
  if (filters.email) params.set('email', filters.email)
  if (filters.active !== undefined) params.set('active', String(filters.active))
  if (filters.moduleId) params.set('moduleId', filters.moduleId)
  if (filters.page !== undefined) params.set('page', String(filters.page))
  if (filters.size !== undefined) params.set('size', String(filters.size))
  const qs = params.toString()
  return http.get<PagedInstructors>(`/admin/users/instructors${qs ? `?${qs}` : ''}`)
}

export async function getModuleGroups(): Promise<ModuleGroup[]> {
  const specs = await getAllSpecializations()
  const groups = await Promise.all(
    specs.map(async (spec) => {
      const { content: modules } = await getModules(spec.id, 0, 1000)
      return {
        specId: spec.id,
        specName: spec.name,
        cohortName: modules[0]?.cohortName ?? '',
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
