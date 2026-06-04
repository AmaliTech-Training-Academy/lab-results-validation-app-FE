const BASE_URL = '/api/v1'

function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

function buildHeaders(extra: Record<string, string> = {}): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

interface ApiEnvelope<T> {
  data: T
  message: string
  success: boolean
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (!text) return undefined as T
  const json = JSON.parse(text)
  // Unwrap the standard { data, success, message } envelope if present
  return 'data' in json && 'success' in json ? (json as ApiEnvelope<T>).data : (json as T)
}

export const http = {
  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(res)
  },
}
