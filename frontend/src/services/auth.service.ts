import type { LoginResponse } from '@/types/auth.types'

// ---------------------------------------------------------------------------
// Mock helpers — DELETE this block and the MOCK_DB when wiring the real API
// ---------------------------------------------------------------------------
function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function makeMockJwt(payload: object): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = toBase64Url(JSON.stringify(payload))
  return `${header}.${body}.mocksignature`
}

// Matches the exact claims produced by the backend's generateToken / buildToken methods:
// claims: { role (uppercase enum name), userId }
// subject: user's email
const MOCK_DB: Record<string, LoginResponse> = {
  'admin@amalitech.com': {
    token: makeMockJwt({ userId: '1', role: 'ADMIN', sub: 'admin@amalitech.com' }),
    email: 'admin@amalitech.com',
    role: 'ADMIN',
    mustChangePassword: false,
  },
  's.jenkins@amalitechtraining.org': {
    token: makeMockJwt({ userId: '2', role: 'INSTRUCTOR', sub: 's.jenkins@amalitechtraining.org' }),
    email: 's.jenkins@amalitechtraining.org',
    role: 'INSTRUCTOR',
    mustChangePassword: true,
  },
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
// ---------------------------------------------------------------------------

export async function loginApi(email: string, _password: string): Promise<LoginResponse> {
  // TODO: replace with → return http.post<LoginResponse>('/auth/login', { email, password })
  await delay(400)
  const response = MOCK_DB[email]
  if (!response) throw new Error('Invalid credentials')
  return response
}

export async function changePasswordApi(_newPassword: string): Promise<void> {
  // TODO: replace with → return http.post('/auth/change-password', { newPassword })
  // The HTTP client will attach the Authorization header automatically via request interceptor.
  await delay(300)
}
