import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useAuthStore', () => {
  describe('initial state', () => {
    it('has no user on initialisation', () => {
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
  })

  describe('login', () => {
    it('sets the user payload', () => {
      const store = useAuthStore()
      store.login({ name: 'David Kim', role: 'admin', initials: 'DK' })
      expect(store.user).toEqual({ name: 'David Kim', role: 'admin', initials: 'DK' })
    })

    it('isAuthenticated becomes true after login', () => {
      const store = useAuthStore()
      store.login({ name: 'David Kim', role: 'admin', initials: 'DK' })
      expect(store.isAuthenticated).toBe(true)
    })

    it('isAdmin is true when role is admin', () => {
      const store = useAuthStore()
      store.login({ name: 'David Kim', role: 'admin', initials: 'DK' })
      expect(store.isAdmin).toBe(true)
      expect(store.isInstructor).toBe(false)
    })

    it('isInstructor is true when role is instructor', () => {
      const store = useAuthStore()
      store.login({ name: 'Sarah Jenkins', role: 'instructor', initials: 'SJ' })
      expect(store.isInstructor).toBe(true)
      expect(store.isAdmin).toBe(false)
    })

    it('overwrites a previous user on re-login', () => {
      const store = useAuthStore()
      store.login({ name: 'David Kim', role: 'admin', initials: 'DK' })
      store.login({ name: 'Sarah Jenkins', role: 'instructor', initials: 'SJ' })
      expect(store.user?.name).toBe('Sarah Jenkins')
      expect(store.isInstructor).toBe(true)
    })
  })

  describe('logout', () => {
    it('clears user to null', () => {
      const store = useAuthStore()
      store.login({ name: 'David Kim', role: 'admin', initials: 'DK' })
      store.logout()
      expect(store.user).toBeNull()
    })

    it('isAuthenticated becomes false after logout', () => {
      const store = useAuthStore()
      store.login({ name: 'David Kim', role: 'admin', initials: 'DK' })
      store.logout()
      expect(store.isAuthenticated).toBe(false)
    })

    it('isAdmin and isInstructor are false after logout', () => {
      const store = useAuthStore()
      store.login({ name: 'David Kim', role: 'admin', initials: 'DK' })
      store.logout()
      expect(store.isAdmin).toBe(false)
      expect(store.isInstructor).toBe(false)
    })
  })
})
