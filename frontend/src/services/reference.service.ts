import type { Specialization, Module, Lab, AddLabPayload, UpdateLabPayload, ForceEditLabPayload } from '@/types/reference.types'
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
    `/admin/labs?moduleId=${moduleId}`,
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
