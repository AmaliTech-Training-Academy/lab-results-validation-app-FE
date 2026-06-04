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
  const mustChangePassword = ref(false)
  const user = ref<AuthUser | null>(null)

  // Hydrate from storage on store creation — only tokens that survived past password setup are persisted
  if (token.value) {
    try {
      user.value = buildUser(decodeJwtPayload(token.value))
    } catch {
      token.value = null
      localStorage.removeItem('auth_token')
    }
  }

  const isAuthenticated = computed(() => user.value !== null)
  const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin']
  const isAdmin = computed(() => !!user.value && ADMIN_ROLES.includes(user.value.role))
  const isInstructor = computed(() => user.value?.role === 'instructor')

  function login(response: LoginResponse) {
    const payload = decodeJwtPayload(response.token)
    user.value = buildUser(payload)
    token.value = response.token
    mustChangePassword.value = response.mustChangePassword
    // Only persist to localStorage once the account is fully set up
    if (!response.mustChangePassword) {
      localStorage.setItem('auth_token', response.token)
    }
  }

  function completedPasswordSetup() {
    mustChangePassword.value = false
    // Now it's safe to persist — the account is fully active
    if (token.value) {
      localStorage.setItem('auth_token', token.value)
    }
  }

  function logout() {
    user.value = null
    token.value = null
    mustChangePassword.value = false
    localStorage.removeItem('auth_token')
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
