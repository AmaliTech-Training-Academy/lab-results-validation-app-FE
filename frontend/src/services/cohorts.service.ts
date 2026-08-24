// Cohort lifecycle + stand-up (PRD Epic A, FE strategy §8). Base path /api/v1.
import { http, BASE_URL, getToken, invalidateCache } from './http'
import type { Cohort, CohortReference, CreateCohortPayload } from '@/types/domain.types'
import type { AttachSharePointLinkPayload, Gate4Job, StandupStatus } from '@/types/standup.types'
import type { Paged } from '@/types/common.types'
import { USE_MOCKS } from './mock/useMocks'

// Short TTL: long enough to collapse the duplicate `GET /cohorts` that fires when the dashboard/runs
// views mount several stores in parallel (each independently checking "do I have cohorts yet?"), short
// enough that a lock/create elsewhere is visible again well within a normal page visit.
const COHORT_LIST_TTL_MS = 20_000
const COHORT_REFERENCE_TTL_MS = 60_000 // frozen once a cohort is stood up — changes far less often than the list

export async function listCohorts(): Promise<Cohort[]> {
  if (USE_MOCKS) {
    const { mockDelay, cohorts } = await import('./mock/fixtures')
    return mockDelay(cohorts)
  }
  const page = await http.get<Paged<Cohort>>('/cohorts', { ttl: COHORT_LIST_TTL_MS })
  return page.content
}

export async function getCohort(id: string): Promise<Cohort> {
  if (USE_MOCKS) {
    const { mockDelay, cohorts } = await import('./mock/fixtures')
    const c = cohorts.find((x) => x.id === id)
    if (!c) throw new Error('Cohort not found')
    return mockDelay(c)
  }
  return http.get<Cohort>(`/cohorts/${id}`, { ttl: COHORT_LIST_TTL_MS })
}

/** The committed, frozen reference hierarchy for a stood-up cohort (§6.3). */
export async function getCohortReference(id: string): Promise<CohortReference> {
  if (USE_MOCKS) {
    const { mockDelay, referenceByCohort, buildReference } = await import('./mock/fixtures')
    return mockDelay(referenceByCohort[id] ?? buildReference(id))
  }
  return http.get<CohortReference>(`/cohorts/${id}/reference`, { ttl: COHORT_REFERENCE_TTL_MS })
}

export async function createCohort(payload: CreateCohortPayload): Promise<Cohort> {
  if (USE_MOCKS) {
    const { mockDelay, genId, cohorts } = await import('./mock/fixtures')
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
      locked: false,
      active: true,
      sharepointFolderUrl: null,
      referenceAcceptedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    cohorts.unshift(cohort)
    return mockDelay(cohort)
  }
  const created = await http.post<Cohort>('/cohorts', payload)
  invalidateCache('/cohorts')
  return created
}

/**
 * Persists the SharePoint folder link (§9a). The backend kicks off Gates 1-3
 * itself once the link is attached, so this is the only call the FE needs to
 * make before opening the stand-up SSE stream.
 */
export async function attachSharePointLink(id: string, payload: AttachSharePointLinkPayload): Promise<void> {
  if (USE_MOCKS) {
    const { mockDelay } = await import('./mock/fixtures')
    const { startStandup } = await import('./mock/standupEngine')
    startStandup(id, payload.folderUrl)
    return mockDelay(undefined)
  }
  await http.patch<void>(`/cohorts/${id}/sharepoint-link`, payload)
  invalidateCache('/cohorts')
}

/**
 * URL for the Gate 1-3 SSE stream (§9b). Browser `EventSource` can't set an
 * `Authorization` header, so the JWT rides in the query string instead.
 */
export function standupStreamUrl(id: string): string {
  const token = getToken() ?? ''
  return `${BASE_URL}/cohorts/${id}/standup/stream?token=${encodeURIComponent(token)}`
}

/** Polled status endpoint (§9). Kept snappy in mocks so gates progress visibly; used as the mock-mode fallback for Gate 4 (no fake SSE server locally). */
export async function fetchStandupStatus(id: string): Promise<StandupStatus> {
  if (USE_MOCKS) {
    const { mockDelay } = await import('./mock/fixtures')
    const { getStandupStatus } = await import('./mock/standupEngine')
    return mockDelay(getStandupStatus(id), 150)
  }
  return http.get<StandupStatus>(`/cohorts/${id}/standup/status`)
}

/** Triggers Gate 4 (empty score-sheet validation) after Accept (§9d). */
export async function triggerGate4(id: string): Promise<void> {
  if (USE_MOCKS) {
    const { mockDelay } = await import('./mock/fixtures')
    return mockDelay(undefined)
  }
  await http.post<Gate4Job>(`/cohorts/${id}/gate4`)
  invalidateCache('/cohorts')
}

/**
 * URL for the Gate 4 SSE stream (§9d). Browser `EventSource` can't set an
 * `Authorization` header, so the JWT rides in the query string instead.
 */
export function gate4StreamUrl(id: string): string {
  const token = getToken() ?? ''
  return `${BASE_URL}/cohorts/${id}/gate4/stream?token=${encodeURIComponent(token)}`
}

export async function acceptCohortReference(id: string): Promise<void> {
  if (USE_MOCKS) {
    const { mockDelay } = await import('./mock/fixtures')
    const { acceptReference } = await import('./mock/standupEngine')
    acceptReference(id)
    return mockDelay(undefined)
  }
  await http.post<void>(`/cohorts/${id}/accept`)
  invalidateCache('/cohorts')
}

export async function discardCohortReference(id: string): Promise<void> {
  if (USE_MOCKS) {
    const { mockDelay } = await import('./mock/fixtures')
    const { discardReference } = await import('./mock/standupEngine')
    discardReference(id)
    return mockDelay(undefined)
  }
  await http.delete<void>(`/cohorts/${id}/accept`)
  invalidateCache('/cohorts')
}

export async function lockCohort(id: string): Promise<void> {
  if (USE_MOCKS) {
    const { mockDelay, cohorts } = await import('./mock/fixtures')
    const c = cohorts.find((x) => x.id === id)
    if (c) c.locked = true
    return mockDelay(undefined)
  }
  await http.patch<void>(`/cohorts/${id}/lock`)
  invalidateCache('/cohorts')
}

export async function unlockCohort(id: string): Promise<void> {
  if (USE_MOCKS) {
    const { mockDelay, cohorts } = await import('./mock/fixtures')
    const c = cohorts.find((x) => x.id === id)
    if (c) c.locked = false
    return mockDelay(undefined)
  }
  await http.patch<void>(`/cohorts/${id}/unlock`)
  invalidateCache('/cohorts')
}
