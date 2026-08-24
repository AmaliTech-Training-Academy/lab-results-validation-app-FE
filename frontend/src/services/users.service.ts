import { http } from './http'
import { USE_MOCKS } from './mock/useMocks'
import type { UserSummary } from '@/types/user.types'

const USER_CACHE_TTL_MS = 5 * 60_000 // emails/names don't change mid-session; this is the #1 re-fetched-by-id lookup (audit rows, run triggers, notification recipients)

export async function getUser(id: string): Promise<UserSummary> {
  if (USE_MOCKS) {
    const { mockDelay } = await import('./mock/fixtures')
    return mockDelay({ id, email: 'admin@amalitech.com' })
  }
  return http.get<UserSummary>(`/users/${id}`, { ttl: USER_CACHE_TTL_MS })
}
