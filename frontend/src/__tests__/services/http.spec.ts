import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, invalidateCache } from '@/services/http'

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

    await expect(http.get('/cohorts/1', { ttl: 10_000 })).rejects.toThrow()
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
