import type { Specialization, Module, Lab, AddLabPayload, ForceEditLabPayload } from '@/types/reference.types'
import { http } from './http'

interface PagedResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  empty: boolean
}

export async function getSpecializations(cohortId: string): Promise<Specialization[]> {
  const page = await http.get<PagedResponse<Specialization>>(
    `/admin/specializations?cohortId=${cohortId}`,
  )
  return page.content
}

export async function getModules(specializationId: string): Promise<Module[]> {
  return http.get<Module[]>(`/modules?specializationId=${specializationId}`)
}

export async function getLabs(moduleId: string): Promise<Lab[]> {
  const page = await http.get<PagedResponse<Lab>>(
    `/admin/modules/${moduleId}/labs`,
  )
  return page.content
}

// ── Mutations — wired once the endpoints are defined ─────────────────────────

export async function addSpecialization(cohortId: string, name: string, code: string): Promise<Specialization> {
  return http.post<Specialization>(`/admin/specializations`, { cohortId, name, code })
}

export async function addModule(specializationId: string, name: string, code: string): Promise<Module> {
  return http.post<Module>(`/admin/specializations/${specializationId}/modules`, { name, code })
}

export async function addLab(payload: AddLabPayload): Promise<Lab> {
  return http.post<Lab>(`/admin/modules/${payload.moduleId}/labs`, {
    title: payload.title,
    maxScore: payload.maxScore,
  })
}

export async function updateLab(labId: string, title: string, maxScore: number): Promise<void> {
  return http.put(`/admin/labs/${labId}`, { title, maxScore })
}

export async function forceEditLab(payload: ForceEditLabPayload): Promise<void> {
  return http.patch(`/admin/labs/${payload.labId}/force-edit`, {
    maxScore: payload.maxScore,
    reason: payload.reason,
  })
}
