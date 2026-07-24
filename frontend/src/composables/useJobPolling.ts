import { ref, computed, onScopeDispose, type Ref, type ComputedRef } from 'vue'
import type { LocatedError } from '@/types/common.types'

/**
 * Generic polling composable for async backend jobs — cohort stand-up (Epic A)
 * and grading sync (Epic B). Views depend on the reactive shape it exposes, NOT
 * on polling itself: this composable is the single **transport swap point**. To
 * move to Server-Sent Events later, replace the internals (open an EventStream
 * and push into `status`) without touching any view (FE strategy §9).
 *
 * A job is polled while its `overall` status is non-terminal
 * (pending/running/processing) and stops on a terminal status
 * (passed/failed/completed/partial/skipped).
 */

/** The minimal contract a pollable status must satisfy. */
export interface JobStatusLike {
  overall: string
}

const NON_TERMINAL = new Set(['pending', 'running', 'processing', 'queued'])

export function isTerminalStatus(overall: string): boolean {
  return !NON_TERMINAL.has(overall)
}

export interface UseJobPollingOptions<T> {
  /** Poll cadence in ms (default 2000). */
  intervalMs?: number
  /** Override terminal detection (default: anything not pending/running/processing/queued). */
  isTerminal?: (status: T) => boolean
  /** Called once when the job reaches a terminal state. */
  onTerminal?: (status: T) => void
}

export interface JobPolling<T> {
  status: Ref<T | null>
  /** Convenience: `status.gates` if present, else []. */
  gates: ComputedRef<unknown[]>
  /** Aggregated errors: top-level `status.errors`, else flattened from `gates`, else []. */
  errors: ComputedRef<LocatedError[]>
  isPolling: Ref<boolean>
  error: Ref<string | null>
  /** Begin polling (idempotent). Fetches immediately, then on the interval. */
  start: () => void
  /** Stop polling and clear the pending timer. */
  stop: () => void
}

export function useJobPolling<T extends JobStatusLike>(
  fetchStatus: () => Promise<T>,
  options: UseJobPollingOptions<T> = {},
): JobPolling<T> {
  const { intervalMs = 2000, isTerminal, onTerminal } = options

  const status = ref<T | null>(null) as Ref<T | null>
  const isPolling = ref(false)
  const error = ref<string | null>(null)

  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const terminal = (s: T) => (isTerminal ? isTerminal(s) : isTerminalStatus(s.overall))

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  async function tick() {
    if (disposed) return
    try {
      const next = await fetchStatus()
      if (disposed) return
      status.value = next
      error.value = null
      if (terminal(next)) {
        stop()
        onTerminal?.(next)
        return
      }
    } catch (e) {
      if (disposed) return
      error.value = e instanceof Error ? e.message : 'Failed to fetch job status'
      // Transient failure — keep polling; a persistent one keeps surfacing the error.
    }
    if (isPolling.value && !disposed) {
      timer = setTimeout(tick, intervalMs)
    }
  }

  function start() {
    if (isPolling.value || disposed) return
    isPolling.value = true
    error.value = null
    void tick()
  }

  function stop() {
    isPolling.value = false
    clearTimer()
  }

  const gates = computed<unknown[]>(() => {
    const s = status.value as (T & { gates?: unknown[] }) | null
    return s?.gates ?? []
  })

  const errors = computed<LocatedError[]>(() => {
    const s = status.value as (T & { errors?: LocatedError[]; gates?: Array<{ errors?: LocatedError[] }> }) | null
    if (!s) return []
    if (Array.isArray(s.errors)) return s.errors
    if (Array.isArray(s.gates)) return s.gates.flatMap((g) => g.errors ?? [])
    return []
  })

  // Auto-cleanup: works whether called in setup() or any active effect scope.
  onScopeDispose(() => {
    disposed = true
    clearTimer()
  })

  return { status, gates, errors, isPolling, error, start, stop }
}
