import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { RouteLocationNormalized, RouteMeta } from 'vue-router'
import { navigationGuard } from '@/router'
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
  token: makeMockJwt({ userId: '1', role: 'ADMIN', sub: 'david.kim@test.com' }),
  email: 'david.kim@test.com',
  role: 'ADMIN',
  mustChangePassword: false,
}

const ADMIN_MUST_CHANGE: LoginResponse = {
  ...ADMIN_RESPONSE,
  mustChangePassword: true,
}

/** Build a minimal RouteLocationNormalized for the guard to inspect */
function mockRoute(name: string, meta: RouteMeta = {}, fullPath?: string): RouteLocationNormalized {
  return {
    name,
    fullPath: fullPath ?? `/${name}`,
    path: fullPath ?? `/${name}`,
    params: {},
    query: {},
    hash: '',
    meta,
    matched: [],
    redirectedFrom: undefined,
  } as unknown as RouteLocationNormalized
}

const PUBLIC = { requiresAuth: false } satisfies RouteMeta
const AUTH_ONLY = { requiresAuth: true } satisfies RouteMeta
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('navigationGuard', () => {
  describe('public routes', () => {
    it('allows unauthenticated access to /login', () => {
      expect(navigationGuard(mockRoute('login'))).toBe(true)
    })

    it('allows unauthenticated access to /403', () => {
      expect(navigationGuard(mockRoute('forbidden'))).toBe(true)
    })

    it('allows any public route through', () => {
      expect(navigationGuard(mockRoute('some-public-route', PUBLIC))).toBe(true)
    })
  })

  describe('authenticated user hitting /login', () => {
    it('redirects admin to admin-dashboard', () => {
      useAuthStore().login(ADMIN_RESPONSE)
      expect(navigationGuard(mockRoute('login'))).toEqual({ name: 'admin-dashboard' })
    })

    it('redirects admin with mustChangePassword to set-password', () => {
      useAuthStore().login(ADMIN_MUST_CHANGE)
      expect(navigationGuard(mockRoute('login'))).toEqual({ name: 'set-password' })
    })
  })

  describe('unauthenticated access to protected routes', () => {
    it('redirects to login preserving the intended URL', () => {
      const result = navigationGuard(mockRoute('admin-dashboard', AUTH_ONLY, '/admin/dashboard'))
      expect(result).toEqual({ name: 'login', query: { redirect: '/admin/dashboard' } })
    })

    it('preserves full path including nested segments', () => {
      const result = navigationGuard(mockRoute('admin-run-review', AUTH_ONLY, '/admin/runs/42'))
      expect(result).toEqual({ name: 'login', query: { redirect: '/admin/runs/42' } })
    })
  })

  describe('mustChangePassword enforcement', () => {
    it('redirects to set-password from any protected route', () => {
      useAuthStore().login(ADMIN_MUST_CHANGE)
      expect(navigationGuard(mockRoute('admin-dashboard', AUTH_ONLY))).toEqual({ name: 'set-password' })
    })

    it('allows through to set-password when mustChangePassword is true', () => {
      useAuthStore().login(ADMIN_MUST_CHANGE)
      expect(navigationGuard(mockRoute('set-password', AUTH_ONLY))).toBe(true)
    })

    it('allows the reset-link set-password (token query) through even when authenticated & already changed', () => {
      useAuthStore().login(ADMIN_RESPONSE)
      const route = mockRoute('set-password', AUTH_ONLY)
      ;(route as unknown as { query: Record<string, string> }).query = { token: 'abc' }
      expect(navigationGuard(route)).toBe(true)
    })
  })

  describe('set-password redirect for users who already changed password', () => {
    it('redirects admin away from set-password to admin-dashboard', () => {
      useAuthStore().login(ADMIN_RESPONSE) // mustChangePassword: false
      expect(navigationGuard(mockRoute('set-password', AUTH_ONLY))).toEqual({ name: 'admin-dashboard' })
    })
  })

  describe('single-role access', () => {
    it('allows an authenticated admin through any /admin route', () => {
      useAuthStore().login(ADMIN_RESPONSE)
      expect(navigationGuard(mockRoute('admin-dashboard', AUTH_ONLY))).toBe(true)
      expect(navigationGuard(mockRoute('admin-runs', AUTH_ONLY))).toBe(true)
      expect(navigationGuard(mockRoute('admin-audit', AUTH_ONLY))).toBe(true)
    })
  })
})
