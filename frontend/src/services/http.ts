const BASE_URL = '/api/v1'

let isRefreshing = false
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function getToken(): string | null {
  return localStorage.getItem('auth_token')
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
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (!text) return undefined as T
  const json = JSON.parse(text)
  return 'data' in json && 'success' in json ? (json as ApiEnvelope<T>).data : (json as T)
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
}
