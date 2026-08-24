import { onScopeDispose } from 'vue'

/** After this many consecutive `error` events with no successful (re)connect between them, stop
 * relying on the browser's own retry and surface a hard "connection lost" state instead. */
const MAX_CONSECUTIVE_ERRORS = 5

/**
 * Shared open/close plumbing for the app's EventSource-backed pipelines
 * (Gates 1-3, Gate 4, sync, notifications) — owns the source/mock-timer/disposed lifecycle;
 * callers own their own state and per-event handlers.
 */
export function useEventSourceStream() {
  let source: EventSource | null = null
  let mockTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  let consecutiveErrors = 0

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
    consecutiveErrors = 0
  }

  /** Closes any existing source and opens a fresh one at `url`. */
  function open(url: string): EventSource {
    closeSource()
    consecutiveErrors = 0
    source = new EventSource(url)
    // A successful (re)connect — including one the browser made on its own — clears the failure streak.
    source.addEventListener('open', () => {
      consecutiveErrors = 0
    })
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

  /**
   * Wraps a caller's `source.onerror` handler with a give-up threshold. Left alone, a native
   * EventSource retries forever on a fixed ~3s interval — fine for a network blip, but useless if the
   * endpoint is down for good (expired auth, a bad deploy, the backend genuinely gone). After
   * `MAX_CONSECUTIVE_ERRORS` in a row with no successful reconnect between them, this closes the
   * source itself — which stops the browser's own auto-retry — and calls `onGiveUp` instead of
   * `onError`, so the caller can surface a "connection lost" state with a manual retry action rather
   * than an indefinite silent spin.
   */
  function withGiveUp(onError: () => void, onGiveUp: () => void): () => void {
    return () => {
      if (disposed) return
      consecutiveErrors += 1
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        stop()
        onGiveUp()
        return
      }
      onError()
    }
  }

  onScopeDispose(() => {
    disposed = true
    stop()
  })

  return { open, stop, bindEvent, scheduleMock, clearMockTimer, isDisposed, withGiveUp }
}
