import type { Specialization, Module, Lab, AddLabPayload, UpdateLabPayload, ForceEditLabPayload, PagedReference } from '@/types/reference.types'
import { http } from './http'

export async function getSpecializations(cohortId: string, page = 0, size = 10): Promise<PagedReference<Specialization>> {
  return http.get<PagedReference<Specialization>>(
    `/admin/specializations?cohortId=${cohortId}&page=${page}&size=${size}`,
  )
}

export async function getAllSpecializations(): Promise<Specialization[]> {
  const result = await http.get<PagedReference<Specialization>>('/admin/specializations?size=100')
  return result.content
}

export async function getModules(specializationId: string, page = 0, size = 10): Promise<PagedReference<Module>> {
  return http.get<PagedReference<Module>>(`/modules?specializationId=${specializationId}&page=${page}&size=${size}`)
}

export async function getLabs(moduleId: string, page = 0, size = 10): Promise<PagedReference<Lab>> {
  return http.get<PagedReference<Lab>>(`/admin/labs?moduleId=${moduleId}&page=${page}&size=${size}`)
}

// ── Mutations — wired once the endpoints are defined ─────────────────────────

export async function addSpecialization(cohortId: string, name: string, code: string): Promise<Specialization> {
  return http.post<Specialization>(`/admin/specializations`, { cohortId, name, code })
}

export async function updateSpecialization(id: string, name: string, code: string): Promise<Specialization> {
  return http.put<Specialization>(`/admin/specializations/${id}`, { name, code })
}

export async function addModule(cohortId: string, specializationId: string, name: string): Promise<Module> {
  return http.post<Module>(`/modules`, { name, cohortId, specializationId })
}

export async function updateModule(id: string, name: string, status: string): Promise<Module> {
  return http.patch<Module>(`/modules/${id}`, { name, status })
}

export async function addLab(payload: AddLabPayload): Promise<Lab> {
  return http.post<Lab>(`/admin/labs`, {
    moduleId: payload.moduleId,
    title: payload.title,
    maxScore: payload.maxScore,
  })
}

export async function updateLab(payload: UpdateLabPayload): Promise<void> {
  return http.put(`/admin/labs/${payload.labId}`, { title: payload.title, maxScore: payload.maxScore })
}

export async function forceEditLab(payload: ForceEditLabPayload): Promise<void> {
  return http.patch(`/admin/labs/${payload.labId}/force-edit`, {
    maxScore: payload.maxScore,
    reason: payload.reason,
  })
}
