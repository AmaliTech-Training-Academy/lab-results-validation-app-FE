export type UserRole = 'admin' | 'instructor'

export interface AuthUser {
  email: string
  name: string     // derived from email local-part on the frontend
  role: UserRole
  initials: string // derived from email local-part on the frontend
}

/** Shape returned by POST /auth/login */
export interface LoginResponse {
  token: string
  email: string
  role: string
  mustChangePassword: boolean
}

/**
 * Claims present in the JWT issued by the backend.
 * role is the Java enum name — uppercase (ADMIN | INSTRUCTOR).
 * sub is the user's email address.
 */
export interface JwtPayload {
  sub: string
  role: string
  userId: string
  iat?: number
  exp?: number
}
