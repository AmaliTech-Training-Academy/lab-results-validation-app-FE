import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '@/views/auth/LoginView.vue'
import { loginApi } from '@/services/auth.service'
import type { LoginResponse } from '@/types/auth.types'

vi.mock('@/services/auth.service', () => ({
  loginApi: vi.fn<() => Promise<LoginResponse>>(),
}))

const testRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div/>' } },
    { path: '/login', name: 'login', component: { template: '<div/>' } },
    { path: '/admin/dashboard', name: 'admin-dashboard', component: { template: '<div/>' } },
    { path: '/set-password', name: 'set-password', component: { template: '<div/>' } },
  ],
})

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(LoginView, { global: { plugins: [pinia, testRouter] } })
  return { wrapper }
}

async function fillAndSubmit(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('#login-email').setValue('admin@amalitech.com')
  await wrapper.find('#login-password').setValue('supersecret')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('LoginView — surfacing the real failure instead of always saying "Invalid email or password"', () => {
  beforeEach(async () => {
    testRouter.push('/login')
    await testRouter.isReady()
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows the backend\'s actual message for a rate-limited login instead of masking it as bad credentials', async () => {
    vi.mocked(loginApi).mockRejectedValue(new Error('Too many requests. Please wait a moment and try again.'))
    const { wrapper } = mountView()

    await fillAndSubmit(wrapper)

    expect(wrapper.text()).toContain('Too many requests. Please wait a moment and try again.')
    expect(wrapper.text()).not.toContain('Invalid email or password.')
  })

  it('shows the backend\'s actual message for a server outage instead of masking it as bad credentials', async () => {
    vi.mocked(loginApi).mockRejectedValue(new Error('An unexpected server error occurred. Please try again later.'))
    const { wrapper } = mountView()

    await fillAndSubmit(wrapper)

    expect(wrapper.text()).toContain('An unexpected server error occurred. Please try again later.')
    expect(wrapper.text()).not.toContain('Invalid email or password.')
  })

  it('still shows the friendlier disabled-account message rather than the raw backend string', async () => {
    vi.mocked(loginApi).mockRejectedValue(new Error('Account is disabled'))
    const { wrapper } = mountView()

    await fillAndSubmit(wrapper)

    expect(wrapper.text()).toContain('Your account has been disabled. Please contact your administrator.')
  })

  it('still shows "Invalid email or password." for genuine bad credentials', async () => {
    vi.mocked(loginApi).mockRejectedValue(new Error('Invalid email or password'))
    const { wrapper } = mountView()

    await fillAndSubmit(wrapper)

    expect(wrapper.text()).toContain('Invalid email or password')
  })
})
