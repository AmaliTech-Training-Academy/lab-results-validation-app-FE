import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser, LoginResponse, JwtPayload, UserRole } from '@/types/auth.types'

function decodeJwtPayload(token: string): JwtPayload {
  const base64Url = token.split('.')[1] ?? ''
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64)) as JwtPayload
}

/** Derives a display name and initials from an email local-part.
 *  s.jenkins@org.com → { name: 'S Jenkins', initials: 'SJ' }
 *  admin@org.com     → { name: 'Admin',     initials: 'A'  }
 */
function deriveDisplayName(email: string): { name: string; initials: string } {
  const local = email.split('@')[0] ?? ''
  const parts = local.split('.')
  const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
  const initials = parts.map((p) => p.charAt(0).toUpperCase()).join('')
  return { name, initials }
}

function buildUser(payload: JwtPayload): AuthUser {
  const { name, initials } = deriveDisplayName(payload.sub)
  return {
    email: payload.sub,
    name,
    role: payload.role.toLowerCase() as UserRole,
    initials,
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const mustChangePassword = ref<boolean>(localStorage.getItem('must_change_password') === 'true')
  const user = ref<AuthUser | null>(null)

  // Hydrate from storage on store creation (survives page refresh)
  if (token.value) {
    try {
      user.value = buildUser(decodeJwtPayload(token.value))
    } catch {
      token.value = null
      localStorage.removeItem('auth_token')
      localStorage.removeItem('must_change_password')
    }
  }

  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isInstructor = computed(() => user.value?.role === 'instructor')

  function login(response: LoginResponse) {
    const payload = decodeJwtPayload(response.token)
    user.value = buildUser(payload)
    token.value = response.token
    mustChangePassword.value = response.mustChangePassword
    localStorage.setItem('auth_token', response.token)
    if (response.mustChangePassword) {
      localStorage.setItem('must_change_password', 'true')
    } else {
      localStorage.removeItem('must_change_password')
    }
  }

  function completedPasswordSetup() {
    mustChangePassword.value = false
    localStorage.removeItem('must_change_password')
  }

  function logout() {
    user.value = null
    token.value = null
    mustChangePassword.value = false
    localStorage.removeItem('auth_token')
    localStorage.removeItem('must_change_password')
  }

  return {
    user,
    token,
    mustChangePassword,
    isAuthenticated,
    isAdmin,
    isInstructor,
    login,
    completedPasswordSetup,
    logout,
  }
})
