import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type UserRole = 'admin' | 'instructor'

export interface AuthUser {
  name: string
  role: UserRole
  initials: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)

  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isInstructor = computed(() => user.value?.role === 'instructor')

  function login(payload: AuthUser) {
    user.value = payload
  }

  function logout() {
    user.value = null
  }

  return { user, isAuthenticated, isAdmin, isInstructor, login, logout }
})
