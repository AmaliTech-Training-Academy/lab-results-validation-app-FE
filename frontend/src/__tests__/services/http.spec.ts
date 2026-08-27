import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, invalidateCache, fetchWithAuth, parseHttpError, setTokenProvider } from '@/services/http'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response
}

describe('http GET cache + in-flight de-dupe', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    invalidateCache('') // the GET cache is a module-level singleton — clear it so tests don't leak into each other
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares one network request across concurrent calls to the same path', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }))

    const [a, b] = await Promise.all([http.get('/cohorts/1'), http.get('/cohorts/1')])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toEqual({ id: '1' })
    expect(b).toEqual({ id: '1' })
  })

  it('re-fetches once the in-flight call resolves, when no ttl is given', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }))

    await http.get('/cohorts/1')
    await http.get('/cohorts/1')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('serves a cached result for ttl-ms after the first call, without hitting the network again', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }))

    await http.get('/cohorts/1', { ttl: 10_000 })
    const second = await http.get('/cohorts/1', { ttl: 10_000 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toEqual({ id: '1' })
  })

  it('does not cache a failed request', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nope' }, false, 500))
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: '1' }))

    await expect(http.get('/cohorts/1', { ttl: 10_000 })).rejects.toThrow('nope')
    const result = await http.get('/cohorts/1', { ttl: 10_000 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ id: '1' })
  })

  it('invalidateCache drops cached results whose path starts with the given prefix', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }))

    await http.get('/cohorts/1', { ttl: 10_000 })
    invalidateCache('/cohorts')
    await http.get('/cohorts/1', { ttl: 10_000 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('leaves cached results under a different prefix alone', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }))

    await http.get('/cohorts/1', { ttl: 10_000 })
    invalidateCache('/notifications')
    await http.get('/cohorts/1', { ttl: 10_000 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never caches mutating methods', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(jsonResponse({ id: '1' }))

    await http.post('/cohorts')
    await http.post('/cohorts')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('fetchWithAuth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    setTokenProvider(() => localStorage.getItem('auth_token'))
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attaches the bearer token and returns the raw response unchanged', async () => {
    localStorage.setItem('auth_token', 'secret-token')
    const body = { ok: 'csv body' }
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response)

    const res = await fetchWithAuth('/admin/program-structure/template', { method: 'GET' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/program-structure/template',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: { Authorization: 'Bearer secret-token' },
      }),
    )
    expect(res).toEqual(expect.objectContaining({ ok: true, status: 200 }))
  })

  it('does not add an Authorization header when there is no token', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') } as Response)

    await fetchWithAuth('/x')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: {} }),
    )
  })
})

describe('parseHttpError', () => {
  it('prefers the backend message from a JSON error body', () => {
    expect(parseHttpError(422, JSON.stringify({ message: 'Cohort already locked' }))).toBe(
      'Cohort already locked',
    )
  })

  it('falls back to a friendly message when there is no usable body', () => {
    expect(parseHttpError(500, '')).toBe('An unexpected server error occurred. Please try again later.')
    expect(parseHttpError(418, '')).toBe('Something went wrong (418). Please try again.')
  })
})
