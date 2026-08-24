// User-defined recurring schedules that trigger score-sheet sync runs. Base path /api/v1.
import { http, invalidateCache } from './http'
import type { SyncSchedulePayload, SyncScheduleResponse } from '@/types/syncSchedule.types'
import { USE_MOCKS } from './mock/useMocks'

const SYNC_SCHEDULES_TTL_MS = 30_000 // low-churn admin config — avoids a full re-list on every Settings ↔ Sync Schedules navigation

// NB: /sync-schedules returns a plain List<T>, not a Spring Page — unlike /cohorts.
export async function listSyncSchedules(): Promise<SyncScheduleResponse[]> {
  if (USE_MOCKS) {
    const { mockDelay, syncSchedules } = await import('./mock/fixtures')
    return mockDelay(syncSchedules)
  }
  return http.get<SyncScheduleResponse[]>('/sync-schedules', { ttl: SYNC_SCHEDULES_TTL_MS })
}

export async function getSyncSchedule(id: string): Promise<SyncScheduleResponse> {
  if (USE_MOCKS) {
    const { mockDelay, syncSchedules } = await import('./mock/fixtures')
    const s = syncSchedules.find((x) => x.id === id)
    if (!s) throw new Error('Sync schedule not found')
    return mockDelay(s)
  }
  return http.get<SyncScheduleResponse>(`/sync-schedules/${id}`, { ttl: SYNC_SCHEDULES_TTL_MS })
}

export async function createSyncSchedule(payload: SyncSchedulePayload): Promise<SyncScheduleResponse> {
  if (USE_MOCKS) {
    const { mockDelay, genId, syncSchedules } = await import('./mock/fixtures')
    const now = new Date().toISOString()
    const created: SyncScheduleResponse = {
      id: genId('sched'),
      name: payload.name,
      cohortId: payload.cohortId ?? null,
      frequency: payload.frequency,
      timeOfDay: payload.timeOfDay,
      dayOfWeek: payload.dayOfWeek ?? null,
      timezone: payload.timezone ?? 'Africa/Accra',
      enabled: payload.enabled,
      createdAt: now,
      updatedAt: now,
    }
    syncSchedules.unshift(created)
    return mockDelay(created)
  }
  const created = await http.post<SyncScheduleResponse>('/sync-schedules', payload)
  invalidateCache('/sync-schedules')
  return created
}

/** PUT is a full replace, including the `enabled` flag. */
export async function updateSyncSchedule(id: string, payload: SyncSchedulePayload): Promise<SyncScheduleResponse> {
  if (USE_MOCKS) {
    const { mockDelay, syncSchedules } = await import('./mock/fixtures')
    const s = syncSchedules.find((x) => x.id === id)
    if (!s) throw new Error('Sync schedule not found')
    Object.assign(s, {
      name: payload.name,
      cohortId: payload.cohortId ?? null,
      frequency: payload.frequency,
      timeOfDay: payload.timeOfDay,
      dayOfWeek: payload.dayOfWeek ?? null,
      timezone: payload.timezone ?? s.timezone,
      enabled: payload.enabled,
      updatedAt: new Date().toISOString(),
    })
    return mockDelay(s)
  }
  const updated = await http.put<SyncScheduleResponse>(`/sync-schedules/${id}`, payload)
  invalidateCache('/sync-schedules')
  return updated
}

export async function removeSyncSchedule(id: string): Promise<void> {
  if (USE_MOCKS) {
    const { mockDelay, syncSchedules } = await import('./mock/fixtures')
    const idx = syncSchedules.findIndex((x) => x.id === id)
    if (idx !== -1) syncSchedules.splice(idx, 1)
    return mockDelay(undefined)
  }
  await http.delete<void>(`/sync-schedules/${id}`)
  invalidateCache('/sync-schedules')
}
