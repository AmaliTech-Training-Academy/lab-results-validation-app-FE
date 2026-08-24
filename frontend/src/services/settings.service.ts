// Admin settings (PRD Epic C C2, FE strategy §8).
import { http, invalidateCache } from './http'
import type { Settings } from '@/types/settings.types'
import { USE_MOCKS } from './mock/useMocks'

const SETTINGS_TTL_MS = 30_000

/** backend: NotificationController, mounted under /notifications — not a standalone /settings resource. */
export async function getSettings(): Promise<Settings> {
  if (USE_MOCKS) {
    const { mockDelay, settings } = await import('./mock/fixtures')
    return mockDelay(settings)
  }
  return http.get<Settings>('/notifications/settings', { ttl: SETTINGS_TTL_MS })
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  if (USE_MOCKS) {
    const { mockDelay, settings } = await import('./mock/fixtures')
    Object.assign(settings, patch)
    return mockDelay(settings)
  }
  const updated = await http.patch<Settings>('/notifications/settings', patch)
  invalidateCache('/notifications/settings')
  return updated
}
