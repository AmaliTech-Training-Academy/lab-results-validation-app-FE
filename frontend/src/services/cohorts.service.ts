// Cohort lifecycle + stand-up (PRD Epic A, FE strategy §8). Base path /api/v1.
import { http } from './http'
import type { Cohort, CohortReference, CreateCohortPayload } from '@/types/domain.types'
import type { StandupStatus, StartStandupPayload } from '@/types/standup.types'
import { USE_MOCKS, mockDelay, genId, cohorts, referenceByCohort, buildReference } from './mock/fixtures'
import {
  startStandup,
  getStandupStatus,
  acceptReference,
  discardReference,
} from './mock/standupEngine'

export async function listCohorts(): Promise<Cohort[]> {
  if (USE_MOCKS) return mockDelay(cohorts)
  return http.get<Cohort[]>('/cohorts')
}

export async function getCohort(id: string): Promise<Cohort> {
  if (USE_MOCKS) {
    const c = cohorts.find((x) => x.id === id)
    if (!c) throw new Error('Cohort not found')
    return mockDelay(c)
  }
  return http.get<Cohort>(`/cohorts/${id}`)
}

/** The committed, frozen reference hierarchy for a stood-up cohort (§6.3). */
export async function getCohortReference(id: string): Promise<CohortReference> {
  if (USE_MOCKS) return mockDelay(referenceByCohort[id] ?? buildReference(id))
  return http.get<CohortReference>(`/cohorts/${id}/reference`)
}

export async function createCohort(payload: CreateCohortPayload): Promise<Cohort> {
  if (USE_MOCKS) {
    const name = payload.name.trim()
    if (cohorts.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Cohort name must be unique')
    }
    const now = new Date().toISOString()
    const cohort: Cohort = {
      id: genId('coh'),
      name,
      startDate: payload.startDate,
      endDate: payload.endDate,
      lifecycleState: 'DRAFT',
      isLocked: false,
      isActive: true,
      sharepointFolderUrl: null,
      referenceAcceptedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    cohorts.unshift(cohort)
    return mockDelay(cohort)
  }
  return http.post<Cohort>('/cohorts', payload)
}

export async function startCohortStandup(id: string, payload: StartStandupPayload): Promise<void> {
  if (USE_MOCKS) {
    startStandup(id, payload.sharepointFolderUrl)
    return mockDelay(undefined)
  }
  return http.post<void>(`/cohorts/${id}/standup`, payload)
}

/** Polled status endpoint (§9). Kept snappy in mocks so gates progress visibly. */
export async function fetchStandupStatus(id: string): Promise<StandupStatus> {
  if (USE_MOCKS) return mockDelay(getStandupStatus(id), 150)
  return http.get<StandupStatus>(`/cohorts/${id}/standup/status`)
}

export async function acceptCohortReference(id: string): Promise<void> {
  if (USE_MOCKS) {
    acceptReference(id)
    return mockDelay(undefined)
  }
  return http.post<void>(`/cohorts/${id}/accept`)
}

export async function discardCohortReference(id: string): Promise<void> {
  if (USE_MOCKS) {
    discardReference(id)
    return mockDelay(undefined)
  }
  return http.post<void>(`/cohorts/${id}/discard`)
}

export async function lockCohort(id: string): Promise<void> {
  if (USE_MOCKS) {
    const c = cohorts.find((x) => x.id === id)
    if (c) c.isLocked = true
    return mockDelay(undefined)
  }
  return http.post<void>(`/cohorts/${id}/lock`)
}

export async function unlockCohort(id: string): Promise<void> {
  if (USE_MOCKS) {
    const c = cohorts.find((x) => x.id === id)
    if (c) c.isLocked = false
    return mockDelay(undefined)
  }
  return http.post<void>(`/cohorts/${id}/unlock`)
}
