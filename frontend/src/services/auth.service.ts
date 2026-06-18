import type { LoginResponse } from '@/types/auth.types'
import { http } from './http'

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  return http.post<LoginResponse>('/auth/login', { email, password })
}

export async function refreshApi(): Promise<LoginResponse> {
  return http.post<LoginResponse>('/auth/refresh')
}

export async function logoutApi(): Promise<void> {
  return http.post<void>('/auth/logout')
}

export async function changePasswordApi(currentPassword: string, newPassword: string): Promise<LoginResponse> {
  return http.post<LoginResponse>('/auth/change-password', { currentPassword, newPassword })
}

export async function forgotPasswordApi(email: string): Promise<void> {
  return http.post<void>('/auth/forgot-password', { email })
}

export async function resetPasswordApi(token: string, newPassword: string): Promise<void> {
  return http.post<void>('/auth/reset-password', { token, newPassword })
}
