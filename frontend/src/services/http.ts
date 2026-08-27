export const BASE_URL = '/api/v1'

const FRIENDLY_ERRORS: Record<number, string> = {
  400: 'Bad request. Please check your input and try again.',
  401: 'You are not authorised. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  408: 'The request timed out. Please try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'An unexpected server error occurred. Please try again later.',
  502: 'The server is temporarily unavailable. Please try again later.',
  503: 'The service is temporarily unavailable. Please try again later.',
  504: 'The server took too long to respond. Please try again later.',
}

export function parseHttpError(status: number, responseText: string): string {
  if (responseText) {
    try {
      const errJson = JSON.parse(responseText) as Record<string, unknown>
      if (typeof errJson.message === 'string') return errJson.message
    } catch {
      // not JSON (e.g. HTML error page from a gateway) — fall through
    }
  }
  return FRIENDLY_ERRORS[status] ?? `Something went wrong (${status}). Please try again.`
}

let isRefreshing = false
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

let tokenProvider: () => string | null = () => localStorage.getItem('auth_token')

export function setTokenProvider(fn: () => string | null) {
  tokenProvider = fn
}

/** The current JWT, if any. Exported so callers that can't send headers (e.g. EventSource) can pass it as a query param. */
export function getToken(): string | null {
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
    throw new Error(parseHttpError(res.status, text))
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

// ── GET cache + in-flight de-dupe ────────────────────────────────────────────
// This app fans out a lot of per-row/per-cohort GETs (conflict totals, run lists,
// user/instructor lookups for display names…). Two things make that cheap instead
// of a request storm:
//  1. In-flight de-dupe: concurrent callers for the same path share one fetch —
//     kills races like two stores both kicking off `GET /cohorts` on the same mount.
//  2. A short result cache (opt-in via `ttl`): a path resolved recently is served
//     from memory instead of re-hitting the network — kills refetch-on-every-mount
//     for data that rarely changes within a session (e.g. a user's email).
// GETs default to ttl 0 (de-dupe only, no stale reads); callers opt into caching
// for slow-changing data. Mutations should call `invalidateCache(prefix)` so the
// next read after a write isn't served a stale cached value.
const inFlightGets = new Map<string, Promise<unknown>>()
const getResultCache = new Map<string, { expiresAt: number; value: unknown }>()

function cachedGet<T>(path: string, ttlMs: number): Promise<T> {
  const cached = getResultCache.get(path)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value as T)

  const pending = inFlightGets.get(path)
  if (pending) return pending as Promise<T>

  const promise = request<T>('GET', path)
    .then((value) => {
      if (ttlMs > 0) getResultCache.set(path, { expiresAt: Date.now() + ttlMs, value })
      return value
    })
    .finally(() => inFlightGets.delete(path))

  inFlightGets.set(path, promise)
  return promise
}

/** Drops cached/in-flight GETs whose path starts with `prefix`. Call after a mutation that makes them stale. */
export function invalidateCache(prefix: string) {
  for (const key of getResultCache.keys()) {
    if (key.startsWith(prefix)) getResultCache.delete(key)
  }
  for (const key of inFlightGets.keys()) {
    if (key.startsWith(prefix)) inFlightGets.delete(key)
  }
}

/**
 * Low-level fetch for bodies the JSON `http` wrapper can't express (FormData uploads, CSV template
 * text/blob downloads) — prints the auth header the same way `request` would but returns the raw
 * `Response` so the caller controls how non-JSON payloads are consumed. Error text is left to the
 * caller; use `parseHttpError` to turn a non-OK response into a backend-friendly message.
 */
export async function fetchWithAuth(path: string, init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}): Promise<Response> {
  const headers: Record<string, string> = { ...init.headers }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' })
}

export const http = {
  async post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, body)
  },
  /** `ttl` (ms) opts into caching the resolved result for reuse by later calls to the same path; omitted/0 still de-dupes concurrent in-flight calls but never serves a stale result. */
  async get<T>(path: string, opts?: { ttl?: number }): Promise<T> {
    return cachedGet<T>(path, opts?.ttl ?? 0)
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
