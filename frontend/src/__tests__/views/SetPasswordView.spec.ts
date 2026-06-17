import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import SetPasswordView from '@/views/auth/SetPasswordView.vue'
import { useAuthStore } from '@/stores/auth'
import { changePasswordApi } from '@/services/auth.service'
import type { LoginResponse } from '@/types/auth.types'

vi.mock('@/services/auth.service', () => ({
  changePasswordApi: vi.fn<() => Promise<LoginResponse>>(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function makeMockJwt(payload: object): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = toBase64Url(JSON.stringify(payload))
  return `${header}.${body}.mocksig`
}

const ADMIN_RESPONSE: LoginResponse = {
  token: makeMockJwt({ userId: '1', role: 'ADMIN', sub: 'admin@test.com' }),
  email: 'admin@test.com',
  role: 'ADMIN',
  mustChangePassword: true,
}
const INSTRUCTOR_RESPONSE: LoginResponse = {
  token: makeMockJwt({ userId: '2', role: 'INSTRUCTOR', sub: 's.jenkins@test.com' }),
  email: 's.jenkins@test.com',
  role: 'INSTRUCTOR',
  mustChangePassword: true,
}
// Tokens the backend issues after a successful password change (role-matched, no mustChangePassword)
const ADMIN_POST_CHANGE_RESPONSE: LoginResponse = {
  token: makeMockJwt({ userId: '1', role: 'ADMIN', sub: 'admin@test.com', iat: 9999 }),
  email: 'admin@test.com',
  role: 'ADMIN',
  mustChangePassword: false,
}
const INSTRUCTOR_POST_CHANGE_RESPONSE: LoginResponse = {
  token: makeMockJwt({ userId: '2', role: 'INSTRUCTOR', sub: 's.jenkins@test.com', iat: 9999 }),
  email: 's.jenkins@test.com',
  role: 'INSTRUCTOR',
  mustChangePassword: false,
}

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div/>' } },
    { path: '/login', name: 'login', component: { template: '<div/>' } },
    { path: '/admin/dashboard', name: 'admin-dashboard', component: { template: '<div/>' } },
    { path: '/instructor/dashboard', name: 'instructor-dashboard', component: { template: '<div/>' } },
    { path: '/set-password', name: 'set-password', component: { template: '<div/>' } },
  ],
})
// ---------------------------------------------------------------------------

describe('SetPasswordView', () => {
  let pushSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorage.clear()
    vi.mocked(changePasswordApi).mockResolvedValue(INSTRUCTOR_POST_CHANGE_RESPONSE)
    pushSpy = vi.spyOn(testRouter, 'push').mockResolvedValue(undefined as never)
  })

  afterEach(() => {
    pushSpy.mockRestore()
    vi.mocked(changePasswordApi).mockReset()
  })

  function mountView(response: LoginResponse) {
    const pinia = createPinia()
    const wrapper = mount(SetPasswordView, { global: { plugins: [pinia, testRouter] } })
    const store = useAuthStore(pinia)
    store.login(response)
    return { wrapper, store }
  }

  async function fillAndSubmit(
    wrapper: ReturnType<typeof mount>,
    pw: string,
    confirm: string,
  ) {
    await wrapper.find('input[placeholder="Enter your new password"]').setValue(pw)
    await wrapper.find('input[placeholder="Re-enter your password"]').setValue(confirm)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
  }

  describe('validation — blocks invalid submits', () => {
    it('does not call the API when password is too short', async () => {
      const { wrapper } = mountView(ADMIN_RESPONSE)
      await fillAndSubmit(wrapper, 'short', 'short')
      expect(changePasswordApi).not.toHaveBeenCalled()
    })

    it('does not call the API when passwords do not match', async () => {
      const { wrapper } = mountView(ADMIN_RESPONSE)
      await fillAndSubmit(wrapper, 'validpass123', 'differentpass')
      expect(changePasswordApi).not.toHaveBeenCalled()
    })

    it('shows password length error after invalid submit', async () => {
      const { wrapper } = mountView(ADMIN_RESPONSE)
      await fillAndSubmit(wrapper, 'short', 'short')
      expect(wrapper.text()).toContain('at least 8 characters')
    })

    it('shows mismatch error after invalid submit', async () => {
      const { wrapper } = mountView(ADMIN_RESPONSE)
      await fillAndSubmit(wrapper, 'validpass123', 'differentpass')
      expect(wrapper.text()).toContain('Passwords do not match')
    })
  })

  describe('successful submit', () => {
    it('calls changePasswordApi with the entered password', async () => {
      const { wrapper } = mountView(ADMIN_RESPONSE)
      await fillAndSubmit(wrapper, 'securepass123!', 'securepass123!')
      expect(changePasswordApi).toHaveBeenCalledWith('', 'securepass123!')
    })

    it('calls completedPasswordSetup on success', async () => {
      const { wrapper, store } = mountView(INSTRUCTOR_RESPONSE)
      await fillAndSubmit(wrapper, 'securepass123!', 'securepass123!')
      expect(store.mustChangePassword).toBe(false)
    })

    it('routes admin to admin-dashboard after success', async () => {
      vi.mocked(changePasswordApi).mockResolvedValueOnce(ADMIN_POST_CHANGE_RESPONSE)
      const { wrapper } = mountView(ADMIN_RESPONSE)
      await fillAndSubmit(wrapper, 'securepass123!', 'securepass123!')
      expect(pushSpy).toHaveBeenCalledWith({ name: 'admin-dashboard' })
    })

    it('routes instructor to instructor-dashboard after success', async () => {
      const { wrapper } = mountView(INSTRUCTOR_RESPONSE)
      await fillAndSubmit(wrapper, 'securepass123!', 'securepass123!')
      expect(pushSpy).toHaveBeenCalledWith({ name: 'instructor-dashboard' })
    })
  })

  describe('API error handling', () => {
    it('shows error message when changePasswordApi throws', async () => {
      vi.mocked(changePasswordApi).mockRejectedValue(new Error('Server error'))
      const { wrapper } = mountView(ADMIN_RESPONSE)
      await fillAndSubmit(wrapper, 'securepass123!', 'securepass123!')
      expect(wrapper.text()).toContain('Failed to set password')
    })

    it('does not navigate when the API throws', async () => {
      vi.mocked(changePasswordApi).mockRejectedValue(new Error('Server error'))
      const { wrapper } = mountView(ADMIN_RESPONSE)
      await fillAndSubmit(wrapper, 'securepass123!', 'securepass123!')
      expect(pushSpy).not.toHaveBeenCalled()
    })
  })
})
