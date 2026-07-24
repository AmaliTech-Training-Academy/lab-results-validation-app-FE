// Admin settings (PRD Epic C C2, FE strategy §8).
import { http } from './http'
import type { Settings } from '@/types/settings.types'
import { USE_MOCKS, mockDelay, settings } from './mock/fixtures'

export async function getSettings(): Promise<Settings> {
  if (USE_MOCKS) return mockDelay(settings)
  return http.get<Settings>('/settings')
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  if (USE_MOCKS) {
    Object.assign(settings, patch)
    if (patch.syncSchedule) settings.syncSchedule = { ...settings.syncSchedule, ...patch.syncSchedule }
    return mockDelay(settings)
  }
  return http.put<Settings>('/settings', patch)
}
