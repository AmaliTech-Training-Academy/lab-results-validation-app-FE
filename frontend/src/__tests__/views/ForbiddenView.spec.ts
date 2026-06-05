import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import ForbiddenView from '@/views/ForbiddenView.vue'
import { useAuthStore } from '@/stores/auth'
import type { LoginResponse } from '@/types/auth.types'

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
  mustChangePassword: false,
}
const INSTRUCTOR_RESPONSE: LoginResponse = {
  token: makeMockJwt({ userId: '2', role: 'INSTRUCTOR', sub: 's.jenkins@test.com' }),
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
    { path: '/403', name: 'forbidden', component: { template: '<div/>' } },
  ],
})
// ---------------------------------------------------------------------------

describe('ForbiddenView', () => {
  let pushSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorage.clear()
    pushSpy = vi.spyOn(testRouter, 'push').mockResolvedValue(undefined as never)
  })

  afterEach(() => {
    pushSpy.mockRestore()
  })

  function mountView(pinia = createPinia()) {
    return {
      wrapper: mount(ForbiddenView, { global: { plugins: [pinia, testRouter] } }),
      store: useAuthStore(pinia),
    }
  }

  describe('rendering', () => {
    it('renders the 403 eyebrow', () => {
      const { wrapper } = mountView()
      expect(wrapper.text()).toContain('403')
    })

    it('renders "Access denied" heading', () => {
      const { wrapper } = mountView()
      expect(wrapper.find('h1').text()).toBe('Access denied')
    })

    it('renders "Back to Dashboard" button', () => {
      const { wrapper } = mountView()
      expect(wrapper.find('button').text()).toContain('Back to Dashboard')
    })
  })

  describe('goToDashboard', () => {
    it('navigates to login when not authenticated', async () => {
      const { wrapper } = mountView()
      await wrapper.find('button').trigger('click')
      expect(pushSpy).toHaveBeenCalledWith({ name: 'login' })
    })

    it('navigates to admin-dashboard for an admin user', async () => {
      const pinia = createPinia()
      const { wrapper, store } = mountView(pinia)
      store.login(ADMIN_RESPONSE)
      await wrapper.find('button').trigger('click')
      expect(pushSpy).toHaveBeenCalledWith({ name: 'admin-dashboard' })
    })

    it('navigates to instructor-dashboard for an instructor user', async () => {
      const pinia = createPinia()
      const { wrapper, store } = mountView(pinia)
      store.login(INSTRUCTOR_RESPONSE)
      await wrapper.find('button').trigger('click')
      expect(pushSpy).toHaveBeenCalledWith({ name: 'instructor-dashboard' })
    })
  })
})
