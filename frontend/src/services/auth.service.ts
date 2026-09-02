import type { LoginResponse } from '@/types/auth.types'
import { http } from './http'
import { USE_MOCKS } from './mock/useMocks'

// --- Mock auth (local testing without a backend) ------------------------------
function b64url(obj: object): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
function mockJwt(email: string): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({ sub: email, role: 'ADMIN', userId: 'mock-admin' })
  return `${header}.${payload}.mocksig`
}
function mockLoginResponse(email: string, mustChangePassword = false): LoginResponse {
  return { token: mockJwt(email), email, role: 'ADMIN', mustChangePassword }
}

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  if (USE_MOCKS) {
    void password
    const { mockDelay } = await import('./mock/fixtures')
    return mockDelay(mockLoginResponse(email))
  }
  return http.post<LoginResponse>('/auth/login', { email, password })
}

export async function logoutApi(): Promise<void> {
  if (USE_MOCKS) {
    const { mockDelay } = await import('./mock/fixtures')
    return mockDelay(undefined)
  }
  return http.post<void>('/auth/logout')
}

export async function changePasswordApi(currentPassword: string, newPassword: string): Promise<LoginResponse> {
  if (USE_MOCKS) {
    void currentPassword
    void newPassword
    const { mockDelay } = await import('./mock/fixtures')
    return mockDelay(mockLoginResponse('admin@amalitech.com'))
  }
  return http.post<LoginResponse>('/auth/change-password', { currentPassword, newPassword })
}

export async function forgotPasswordApi(email: string): Promise<void> {
  if (USE_MOCKS) {
    const { mockDelay } = await import('./mock/fixtures')
    return mockDelay(undefined)
  }
  return http.post<void>('/auth/forgot-password', { email })
}

export async function resetPasswordApi(token: string, newPassword: string): Promise<void> {
  if (USE_MOCKS) {
    const { mockDelay } = await import('./mock/fixtures')
    return mockDelay(undefined)
  }
  return http.post<void>('/auth/reset-password', { token, newPassword })
}
