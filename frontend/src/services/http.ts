const BASE_URL = '/api/v1'

let isRefreshing = false
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

let tokenProvider: () => string | null = () => localStorage.getItem('auth_token')

export function setTokenProvider(fn: () => string | null) {
  tokenProvider = fn
}

function getToken(): string | null {
  return tokenProvider()
}

function buildHeaders(tokenOverride?: string): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = tokenOverride ?? getToken()
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
    let message = text || `HTTP ${res.status}`
    if (text) {
      try {
        const errJson = JSON.parse(text) as Record<string, unknown>
        if (typeof errJson.message === 'string') message = errJson.message
      } catch {
        // not JSON — use raw text
      }
    }
    throw new Error(message)
  }
  if (!text) return undefined as T
  const json = JSON.parse(text) as Record<string, unknown>
  if ('data' in json && 'success' in json) {
    const envelope = json as unknown as ApiEnvelope<T>
    if (!envelope.success) {
      throw new Error(envelope.message || 'Request failed')
    }
    return envelope.data
  }
  return json as unknown as T
}

// Calls the refresh endpoint directly (bypasses the interceptor to avoid infinite loops)
async function performRefresh(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error('Token refresh failed')
  const text = await res.text()
  const json = JSON.parse(text) as ApiEnvelope<{ token: string }> | { token: string }
  const token = ('data' in json ? json.data.token : json.token)
  localStorage.setItem('auth_token', token)
  return token
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: buildHeaders(),
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Don't attempt refresh for non-401s or for the refresh endpoint itself
  if (res.status !== 401 || path === '/auth/refresh') {
    return handleResponse<T>(res)
  }

  // Another refresh is already in flight — queue this request to retry after it resolves
  if (isRefreshing) {
    const newToken = await new Promise<string>((resolve, reject) => {
      pendingQueue.push({ resolve, reject })
    })
    const retryRes = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: buildHeaders(newToken),
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(retryRes)
  }

  isRefreshing = true
  try {
    const newToken = await performRefresh()
    pendingQueue.forEach(({ resolve }) => resolve(newToken))
    const retryRes = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: buildHeaders(newToken),
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(retryRes)
  } catch (err) {
    pendingQueue.forEach(({ reject }) => reject(err))
    window.dispatchEvent(new CustomEvent('auth:session-expired'))
    throw new Error('Session expired. Please log in again.')
  } finally {
    pendingQueue = []
    isRefreshing = false
  }
}

export const http = {
  async post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, body)
  },
  async get<T>(path: string): Promise<T> {
    return request<T>('GET', path)
  },
  async put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PUT', path, body)
  },
  async patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, body)
  },
  async delete<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('DELETE', path, body)
  },
}
