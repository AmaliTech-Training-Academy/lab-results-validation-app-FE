import type { LoginResponse } from '@/types/auth.types'
import { http } from './http'

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  return http.post<LoginResponse>('/auth/login', { email, password })
}

export async function changePasswordApi(_newPassword: string): Promise<void> {
  // TODO: wire up when backend change-password endpoint is ready
}
