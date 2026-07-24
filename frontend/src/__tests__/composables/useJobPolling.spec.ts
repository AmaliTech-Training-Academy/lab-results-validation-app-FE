import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope } from 'vue'
import { useJobPolling, isTerminalStatus } from '@/composables/useJobPolling'

interface Status {
  overall: string
  gates?: Array<{ id: string; label: string; status: string; errors?: { message: string }[] }>
}

describe('isTerminalStatus', () => {
  it('non-terminal for in-flight states', () => {
    expect(isTerminalStatus('pending')).toBe(false)
    expect(isTerminalStatus('running')).toBe(false)
    expect(isTerminalStatus('processing')).toBe(false)
    expect(isTerminalStatus('queued')).toBe(false)
  })
  it('terminal for finished states', () => {
    expect(isTerminalStatus('passed')).toBe(true)
    expect(isTerminalStatus('failed')).toBe(true)
    expect(isTerminalStatus('completed')).toBe(true)
    expect(isTerminalStatus('partial')).toBe(true)
    expect(isTerminalStatus('skipped')).toBe(true)
  })
})

describe('useJobPolling', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function run(fn: () => Promise<Status>, opts?: Parameters<typeof useJobPolling<Status>>[1]) {
    const scope = effectScope()
    let polling!: ReturnType<typeof useJobPolling<Status>>
    scope.run(() => {
      polling = useJobPolling<Status>(fn, opts)
    })
    return { scope, polling }
  }

  it('polls until terminal, then stops and calls onTerminal', async () => {
    const fetchStatus = vi.fn<() => Promise<Status>>()
    fetchStatus.mockResolvedValueOnce({ overall: 'running', gates: [] })
    fetchStatus.mockResolvedValueOnce({ overall: 'running', gates: [] })
    fetchStatus.mockResolvedValueOnce({ overall: 'passed', gates: [] })
    const onTerminal = vi.fn<(s: Status) => void>()
    const { scope, polling } = run(fetchStatus, { intervalMs: 1000, onTerminal })

    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
    expect(polling.isPolling.value).toBe(true)
    expect(polling.status.value?.overall).toBe('running')

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchStatus).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchStatus).toHaveBeenCalledTimes(3)
    expect(polling.isPolling.value).toBe(false)
    expect(onTerminal).toHaveBeenCalledTimes(1)
    expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ overall: 'passed' }))

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchStatus).toHaveBeenCalledTimes(3) // no further polling once terminal
    scope.stop()
  })

  it('start() is idempotent', async () => {
    const fetchStatus = vi.fn<() => Promise<Status>>().mockResolvedValue({ overall: 'running', gates: [] })
    const { scope, polling } = run(fetchStatus, { intervalMs: 1000 })
    polling.start()
    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
    polling.stop()
    scope.stop()
  })

  it('keeps polling after a transient error and surfaces it', async () => {
    const fetchStatus = vi.fn<() => Promise<Status>>()
    fetchStatus.mockRejectedValueOnce(new Error('boom'))
    fetchStatus.mockResolvedValueOnce({ overall: 'passed', gates: [] })
    const { scope, polling } = run(fetchStatus, { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(polling.error.value).toBe('boom')
    expect(polling.isPolling.value).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(polling.status.value?.overall).toBe('passed')
    expect(polling.isPolling.value).toBe(false)
    scope.stop()
  })

  it('stops polling when the scope is disposed (unmount cleanup)', async () => {
    const fetchStatus = vi.fn<() => Promise<Status>>().mockResolvedValue({ overall: 'running', gates: [] })
    const { scope, polling } = run(fetchStatus, { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
    scope.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
  })

  it('aggregates gate errors into errors', async () => {
    const fetchStatus = vi.fn<() => Promise<Status>>().mockResolvedValue({
      overall: 'failed',
      gates: [{ id: 'gate1', label: 'Gate 1', status: 'failed', errors: [{ message: 'bad link' }] }],
    })
    const { scope, polling } = run(fetchStatus, { intervalMs: 1000 })
    polling.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(polling.errors.value).toEqual([{ message: 'bad link' }])
    scope.stop()
  })
})
