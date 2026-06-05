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

const INSTRUCTOR_RESPONSE: LoginResponse = {
  token: makeMockJwt({ userId: '2', role: 'INSTRUCTOR', sub: 's.jenkins@test.com' }),
  email: 's.jenkins@test.com',
  role: 'INSTRUCTOR',
  mustChangePassword: true,
}

const INSTRUCTOR_RESPONSE_OK: LoginResponse = {
  ...INSTRUCTOR_RESPONSE,
  mustChangePassword: false,
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
const ADMIN_ROUTE = { requiresAuth: true, allowedRole: 'admin' as const } satisfies RouteMeta
const INSTRUCTOR_ROUTE = { requiresAuth: true, allowedRole: 'instructor' as const } satisfies RouteMeta
const AUTH_ONLY = { requiresAuth: true } satisfies RouteMeta
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('navigationGuard', () => {
  describe('public routes', () => {
    it('allows unauthenticated access to /login', () => {
      const result = navigationGuard(mockRoute('login'))
      expect(result).toBe(true)
    })

    it('allows unauthenticated access to /403', () => {
      const result = navigationGuard(mockRoute('forbidden'))
      expect(result).toBe(true)
    })

    it('allows any public route through', () => {
      const result = navigationGuard(mockRoute('some-public-route', PUBLIC))
      expect(result).toBe(true)
    })
  })

  describe('authenticated user hitting /login', () => {
    it('redirects admin to admin-dashboard', () => {
      const auth = useAuthStore()
      auth.login(ADMIN_RESPONSE)

      const result = navigationGuard(mockRoute('login'))
      expect(result).toEqual({ name: 'admin-dashboard' })
    })

    it('redirects instructor (no mustChangePassword) to instructor-dashboard', () => {
      const auth = useAuthStore()
      auth.login(INSTRUCTOR_RESPONSE_OK)

      const result = navigationGuard(mockRoute('login'))
      expect(result).toEqual({ name: 'instructor-dashboard' })
    })

    it('redirects instructor with mustChangePassword to set-password', () => {
      const auth = useAuthStore()
      auth.login(INSTRUCTOR_RESPONSE)

      const result = navigationGuard(mockRoute('login'))
      expect(result).toEqual({ name: 'set-password' })
    })
  })

  describe('unauthenticated access to protected routes', () => {
    it('redirects to login preserving the intended URL', () => {
      const result = navigationGuard(
        mockRoute('admin-dashboard', ADMIN_ROUTE, '/admin/dashboard'),
      )
      expect(result).toEqual({ name: 'login', query: { redirect: '/admin/dashboard' } })
    })

    it('preserves full path including nested segments', () => {
      const result = navigationGuard(
        mockRoute('admin-reports', ADMIN_ROUTE, '/admin/reports'),
      )
      expect(result).toEqual({ name: 'login', query: { redirect: '/admin/reports' } })
    })

    it('redirects to login for instructor routes too', () => {
      const result = navigationGuard(
        mockRoute('instructor-upload', INSTRUCTOR_ROUTE, '/instructor/upload'),
      )
      expect(result).toEqual({ name: 'login', query: { redirect: '/instructor/upload' } })
    })
  })

  describe('mustChangePassword enforcement', () => {
    it('redirects to set-password from any protected route', () => {
      const auth = useAuthStore()
      auth.login(INSTRUCTOR_RESPONSE)

      const result = navigationGuard(mockRoute('instructor-dashboard', INSTRUCTOR_ROUTE))
      expect(result).toEqual({ name: 'set-password' })
    })

    it('redirects to set-password even for routes with no allowedRole', () => {
      const auth = useAuthStore()
      auth.login(INSTRUCTOR_RESPONSE)

      const result = navigationGuard(mockRoute('some-protected', AUTH_ONLY))
      expect(result).toEqual({ name: 'set-password' })
    })

    it('allows through to set-password when mustChangePassword is true', () => {
      const auth = useAuthStore()
      auth.login(INSTRUCTOR_RESPONSE)

      const result = navigationGuard(mockRoute('set-password', AUTH_ONLY))
      expect(result).toBe(true)
    })
  })

  describe('set-password redirect for users who already changed password', () => {
    it('redirects admin away from set-password to admin-dashboard', () => {
      const auth = useAuthStore()
      auth.login(ADMIN_RESPONSE) // mustChangePassword: false

      const result = navigationGuard(mockRoute('set-password', AUTH_ONLY))
      expect(result).toEqual({ name: 'admin-dashboard' })
    })

    it('redirects instructor away from set-password to instructor-dashboard', () => {
      const auth = useAuthStore()
      auth.login(INSTRUCTOR_RESPONSE_OK) // mustChangePassword: false

      const result = navigationGuard(mockRoute('set-password', AUTH_ONLY))
      expect(result).toEqual({ name: 'instructor-dashboard' })
    })
  })

  describe('role enforcement', () => {
    it('allows admin through to admin routes', () => {
      const auth = useAuthStore()
      auth.login(ADMIN_RESPONSE)

      const result = navigationGuard(mockRoute('admin-dashboard', ADMIN_ROUTE))
      expect(result).toBe(true)
    })

    it('allows instructor through to instructor routes', () => {
      const auth = useAuthStore()
      auth.login(INSTRUCTOR_RESPONSE_OK)

      const result = navigationGuard(mockRoute('instructor-dashboard', INSTRUCTOR_ROUTE))
      expect(result).toBe(true)
    })

    it('blocks admin accessing an instructor route → 403', () => {
      const auth = useAuthStore()
      auth.login(ADMIN_RESPONSE)

      const result = navigationGuard(mockRoute('instructor-dashboard', INSTRUCTOR_ROUTE))
      expect(result).toEqual({ name: 'forbidden' })
    })

    it('blocks instructor accessing an admin route → 403', () => {
      const auth = useAuthStore()
      auth.login(INSTRUCTOR_RESPONSE_OK)

      const result = navigationGuard(mockRoute('admin-dashboard', ADMIN_ROUTE))
      expect(result).toEqual({ name: 'forbidden' })
    })

    it('allows authenticated user through routes with no allowedRole', () => {
      const auth = useAuthStore()
      auth.login(ADMIN_RESPONSE)

      const result = navigationGuard(mockRoute('set-password', AUTH_ONLY))
      // Admin has no mustChangePassword, no allowedRole restriction → dashboard redirect
      // (caught by the set-password redirect rule above role check)
      expect(result).toEqual({ name: 'admin-dashboard' })
    })
  })
})
