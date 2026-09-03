import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '@/stores/toast'

const { push, currentRoute } = vi.hoisted(() => ({
  push: vi.fn<(to: unknown) => Promise<unknown>>(),
  currentRoute: { value: { name: 'admin-runs', fullPath: '/admin/runs?q=foo' } },
}))
vi.mock('@/router', () => ({
  default: { push, get currentRoute() { return currentRoute } },
}))

import { handleSessionExpired } from '@/utils/handleSessionExpired'

beforeEach(() => {
  setActivePinia(createPinia())
  push.mockClear()
  currentRoute.value = { name: 'admin-runs', fullPath: '/admin/runs?q=foo' }
})

describe('handleSessionExpired', () => {
  it('shows a specific, actionable toast instead of a generic error', () => {
    handleSessionExpired()

    const toast = useToastStore()
    const last = toast.toasts[toast.toasts.length - 1]
    expect(last?.title).toBe('Session expired')
    expect(last?.body).toBe('Please log in again to continue.')
  })

  it('redirects to login with the current page as the return path', () => {
    handleSessionExpired()

    expect(push).toHaveBeenCalledWith({ name: 'login', query: { redirect: '/admin/runs?q=foo' } })
  })

  it('does nothing when already on the login page — no toast, no redirect', () => {
    currentRoute.value = { name: 'login', fullPath: '/login' }

    handleSessionExpired()

    const toast = useToastStore()
    expect(toast.toasts).toHaveLength(0)
    expect(push).not.toHaveBeenCalled()
  })
})
