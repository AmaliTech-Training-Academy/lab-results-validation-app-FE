import { onScopeDispose } from 'vue'

/**
 * Shared open/close plumbing for the app's EventSource-backed pipelines
 * (Gates 1-3, Gate 4, sync) — owns the source/mock-timer/disposed lifecycle;
 * callers own their own state and per-event handlers.
 */
export function useEventSourceStream() {
  let source: EventSource | null = null
  let mockTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  function closeSource() {
    source?.close()
    source = null
  }

  function clearMockTimer() {
    if (mockTimer) {
      clearTimeout(mockTimer)
      mockTimer = null
    }
  }

  /** Closes the source and cancels any pending mock timer. */
  function stop() {
    closeSource()
    clearMockTimer()
  }

  /** Closes any existing source and opens a fresh one at `url`. */
  function open(url: string): EventSource {
    closeSource()
    source = new EventSource(url)
    return source
  }

  function bindEvent<T>(name: string, handler: (data: T) => void, onMalformed: () => void) {
    source?.addEventListener(name, (e) => {
      try {
        handler(JSON.parse((e as MessageEvent).data) as T)
      } catch {
        onMalformed()
      }
    })
  }

  function scheduleMock(fn: () => void, delayMs: number) {
    mockTimer = setTimeout(fn, delayMs)
  }

  function isDisposed() {
    return disposed
  }

  onScopeDispose(() => {
    disposed = true
    stop()
  })

  return { open, stop, bindEvent, scheduleMock, clearMockTimer, isDisposed }
}
