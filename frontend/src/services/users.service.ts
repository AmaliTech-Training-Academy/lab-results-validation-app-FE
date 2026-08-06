import { http } from './http'
import { USE_MOCKS } from './mock/useMocks'
import type { UserSummary } from '@/types/user.types'

export async function getUser(id: string): Promise<UserSummary> {
  if (USE_MOCKS) {
    const { mockDelay } = await import('./mock/fixtures')
    return mockDelay({ id, email: 'admin@amalitech.com' })
  }
  return http.get<UserSummary>(`/users/${id}`)
}
