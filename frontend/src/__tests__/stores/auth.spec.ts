import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { LoginResponse } from '@/types/auth.types'

// ---------------------------------------------------------------------------
// Helpers — mirrors auth.service.ts mock JWT construction
// ---------------------------------------------------------------------------
function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function makeMockJwt(payload: object): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = toBase64Url(JSON.stringify(payload))
  return `${header}.${body}.mocksig`
}

// Payloads match backend's generateToken / buildToken exactly
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
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useAuthStore', () => {
  describe('initial state', () => {
    it('has no user when localStorage is empty', () => {
      const store = useAuthStore()
      expect(store.user).toBeNull()
    })

    it('isAuthenticated is false before login', () => {
      const store = useAuthStore()
      expect(store.isAuthenticated).toBe(false)
    })

    it('isAdmin is false before login', () => {
      const store = useAuthStore()
      expect(store.isAdmin).toBe(false)
    })

    it('isInstructor is false before login', () => {
      const store = useAuthStore()
      expect(store.isInstructor).toBe(false)
    })

    it('mustChangePassword is false when localStorage is empty', () => {
      const store = useAuthStore()
      expect(store.mustChangePassword).toBe(false)
    })
  })

  describe('login', () => {
    it('decodes role from JWT claim (lowercases the uppercase enum name)', () => {
      const store = useAuthStore()
      store.login(ADMIN_RESPONSE)
      expect(store.user?.role).toBe('admin')
    })

    it('derives name and initials from the email subject', () => {
      const store = useAuthStore()
      store.login(ADMIN_RESPONSE) // sub: david.kim@test.com
      expect(store.user?.name).toBe('David Kim')
      expect(store.user?.initials).toBe('DK')
    })

    it('derives single-part name when email has no dot in local-part', () => {
      const response: LoginResponse = {
        token: makeMockJwt({ userId: '3', role: 'ADMIN', sub: 'admin@test.com' }),
        email: 'admin@test.com',
        role: 'ADMIN',
        mustChangePassword: false,
      }
      const store = useAuthStore()
      store.login(response)
      expect(store.user?.name).toBe('Admin')
      expect(store.user?.initials).toBe('A')
    })

    it('stores the email from the JWT subject', () => {
      const store = useAuthStore()
      store.login(ADMIN_RESPONSE)
      expect(store.user?.email).toBe('david.kim@test.com')
    })

    it('isAuthenticated becomes true after login', () => {
      const store = useAuthStore()
      store.login(ADMIN_RESPONSE)
      expect(store.isAuthenticated).toBe(true)
    })

    it('isAdmin is true for ADMIN role', () => {
      const store = useAuthStore()
      store.login(ADMIN_RESPONSE)
      expect(store.isAdmin).toBe(true)
      expect(store.isInstructor).toBe(false)
    })

    it('isInstructor is true for INSTRUCTOR role', () => {
      const store = useAuthStore()
      store.login(INSTRUCTOR_RESPONSE)
      expect(store.isInstructor).toBe(true)
      expect(store.isAdmin).toBe(false)
    })

    it('sets mustChangePassword from response flag', () => {
      const store = useAuthStore()
      store.login(INSTRUCTOR_RESPONSE)
      expect(store.mustChangePassword).toBe(true)
    })

    it('does not set mustChangePassword when flag is false', () => {
      const store = useAuthStore()
      store.login(ADMIN_RESPONSE)
      expect(store.mustChangePassword).toBe(false)
    })

    it('persists token to localStorage', () => {
      const store = useAuthStore()
      store.login(ADMIN_RESPONSE)
      expect(localStorage.getItem('auth_token')).toBe(ADMIN_RESPONSE.token)
    })

    it('writes must_change_password key to localStorage when true', () => {
      const store = useAuthStore()
      store.login(INSTRUCTOR_RESPONSE)
      expect(localStorage.getItem('must_change_password')).toBe('true')
    })

    it('does not write must_change_password key when flag is false', () => {
      const store = useAuthStore()
      store.login(ADMIN_RESPONSE)
      expect(localStorage.getItem('must_change_password')).toBeNull()
    })

    it('overwrites previous session on re-login', () => {
      const store = useAuthStore()
      store.login(ADMIN_RESPONSE)
      store.login(INSTRUCTOR_RESPONSE)
      expect(store.user?.role).toBe('instructor')
      expect(store.isInstructor).toBe(true)
    })
  })

  describe('initFromStorage (page refresh)', () => {
    it('hydrates user from a valid token in localStorage', () => {
      localStorage.setItem('auth_token', ADMIN_RESPONSE.token)
      const store = useAuthStore()
      expect(store.user?.role).toBe('admin')
      expect(store.user?.email).toBe('david.kim@test.com')
      expect(store.isAuthenticated).toBe(true)
    })

    it('restores mustChangePassword from localStorage', () => {
      localStorage.setItem('auth_token', INSTRUCTOR_RESPONSE.token)
      localStorage.setItem('must_change_password', 'true')
      const store = useAuthStore()
      expect(store.mustChangePassword).toBe(true)
    })

    it('clears storage and leaves user null when token is malformed', () => {
      localStorage.setItem('auth_token', 'not.a.valid.token')
      const store = useAuthStore()
      expect(store.user).toBeNull()
      expect(localStorage.getItem('auth_token')).toBeNull()
    })
  })

  describe('completedPasswordSetup', () => {
    it('clears mustChangePassword ref', () => {
      const store = useAuthStore()
      store.login(INSTRUCTOR_RESPONSE)
      store.completedPasswordSetup()
      expect(store.mustChangePassword).toBe(false)
    })

    it('removes must_change_password key from localStorage', () => {
      const store = useAuthStore()
      store.login(INSTRUCTOR_RESPONSE)
      store.completedPasswordSetup()
      expect(localStorage.getItem('must_change_password')).toBeNull()
    })

    it('leaves user and token intact', () => {
      const store = useAuthStore()
      store.login(INSTRUCTOR_RESPONSE)
      store.completedPasswordSetup()
      expect(store.user).not.toBeNull()
      expect(store.token).not.toBeNull()
    })
  })

  describe('logout', () => {
    it('clears user, token, and mustChangePassword', () => {
      const store = useAuthStore()
      store.login(INSTRUCTOR_RESPONSE)
      store.logout()
      expect(store.user).toBeNull()
      expect(store.token).toBeNull()
      expect(store.mustChangePassword).toBe(false)
    })

    it('isAuthenticated becomes false after logout', () => {
      const store = useAuthStore()
      store.login(ADMIN_RESPONSE)
      store.logout()
      expect(store.isAuthenticated).toBe(false)
    })

    it('wipes both localStorage keys on logout', () => {
      const store = useAuthStore()
      store.login(INSTRUCTOR_RESPONSE)
      store.logout()
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('must_change_password')).toBeNull()
    })
  })
})
