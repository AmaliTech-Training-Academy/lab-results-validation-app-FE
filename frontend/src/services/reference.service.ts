import type { Specialization, Module, Lab, AddLabPayload, UpdateLabPayload, ForceEditLabPayload, PagedReference } from '@/types/reference.types'
import { http, invalidateCache } from './http'

// Low-churn admin config; caching this collapses the getModuleGroups() fan-out (one GET per
// specialization) on repeat visits, plus dedupes concurrent identical calls within a page load.
const REFERENCE_TTL_MS = 30_000

export async function getSpecializations(cohortId: string, page = 0, size = 10): Promise<PagedReference<Specialization>> {
  return http.get<PagedReference<Specialization>>(
    `/admin/specializations?cohortId=${cohortId}&page=${page}&size=${size}`,
    { ttl: REFERENCE_TTL_MS },
  )
}

export async function getAllSpecializations(): Promise<Specialization[]> {
  const result = await http.get<PagedReference<Specialization>>('/admin/specializations?size=100', {
    ttl: REFERENCE_TTL_MS,
  })
  return result.content
}

export async function getModules(specializationId: string, page = 0, size = 10): Promise<PagedReference<Module>> {
  return http.get<PagedReference<Module>>(
    `/modules?specializationId=${specializationId}&page=${page}&size=${size}`,
    { ttl: REFERENCE_TTL_MS },
  )
}

export async function getLabs(moduleId: string, page = 0, size = 10): Promise<PagedReference<Lab>> {
  return http.get<PagedReference<Lab>>(`/admin/labs?moduleId=${moduleId}&page=${page}&size=${size}`, {
    ttl: REFERENCE_TTL_MS,
  })
}

// ── Mutations — wired once the endpoints are defined ─────────────────────────

export async function addSpecialization(cohortId: string, name: string, code: string): Promise<Specialization> {
  const created = await http.post<Specialization>(`/admin/specializations`, { cohortId, name, code })
  invalidateCache('/admin/specializations')
  return created
}

export async function updateSpecialization(id: string, name: string, code: string): Promise<Specialization> {
  const updated = await http.put<Specialization>(`/admin/specializations/${id}`, { name, code })
  invalidateCache('/admin/specializations')
  return updated
}

export async function addModule(cohortId: string, specializationId: string, name: string): Promise<Module> {
  const created = await http.post<Module>(`/modules`, { name, cohortId, specializationId })
  invalidateCache('/modules')
  return created
}

export async function updateModule(id: string, name: string, status: string): Promise<Module> {
  const updated = await http.patch<Module>(`/modules/${id}`, { name, status })
  invalidateCache('/modules')
  return updated
}

export async function addLab(payload: AddLabPayload): Promise<Lab> {
  const created = await http.post<Lab>(`/admin/labs`, {
    moduleId: payload.moduleId,
    title: payload.title,
    maxScore: payload.maxScore,
  })
  invalidateCache('/admin/labs')
  return created
}

export async function updateLab(payload: UpdateLabPayload): Promise<void> {
  await http.patch(`/admin/labs/${payload.labId}`, { title: payload.title, maxScore: payload.maxScore })
  invalidateCache('/admin/labs')
}

export async function forceEditLab(payload: ForceEditLabPayload): Promise<void> {
  await http.patch(`/admin/labs/${payload.labId}/force-edit`, {
    maxScore: payload.maxScore,
    reason: payload.reason,
  })
  invalidateCache('/admin/labs')
}
