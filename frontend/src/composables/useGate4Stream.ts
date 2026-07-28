import { ref, computed, onScopeDispose, type Ref, type ComputedRef } from 'vue'
import type { LocatedError } from '@/types/common.types'
import type {
  FileFailedData,
  FileGateResult,
  FilePassedData,
  FileProcessingData,
  Gate4DoneData,
} from '@/types/standup.types'
import { gate4StreamUrl } from '@/services/cohorts.service'
import { USE_MOCKS } from '@/services/mock/fixtures'

export type Gate4Overall = 'idle' | 'running' | 'passed' | 'failed'

export interface UseGate4StreamOptions {
  /** Called once when gate4.done arrives (or the mock equivalent resolves). */
  onDone?: (overall: Gate4Overall) => void
}

export interface Gate4Stream {
  files: Ref<FileGateResult[]>
  overall: Ref<Gate4Overall>
  errors: ComputedRef<LocatedError[]>
  isPolling: Ref<boolean>
  error: Ref<string | null>
  start: () => void
  stop: () => void
}

/**
 * Drives Gate 4 (empty score-sheet validation) over the backend's own SSE
 * stream (§9d) — separate from the Gate 1-3 stream: after
 * `startCohortStandup` triggers POST /gate4, this opens GET /gate4/stream and
 * turns file.processing / file.passed / file.failed / gate4.done events into
 * a per-file result list. There's no fake SSE server for local dev and no
 * status endpoint is called on accept, so mock mode just simulates a couple
 * of files passing locally, with no network call at all.
 */
export function useGate4Stream(cohortId: string, options: UseGate4StreamOptions = {}): Gate4Stream {
  const files = ref<FileGateResult[]>([]) as Ref<FileGateResult[]>
  const overall = ref<Gate4Overall>('idle')
  const isPolling = ref(false)
  const error = ref<string | null>(null)

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

  function stop() {
    isPolling.value = false
    closeSource()
    clearMockTimer()
  }

  function upsertFile(file: string, patch: Partial<FileGateResult>) {
    const idx = files.value.findIndex((f) => f.file === file)
    if (idx === -1) {
      files.value = [...files.value, { file, status: 'processing', errors: [], ...patch }]
    } else {
      files.value = files.value.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    }
  }

  function handleProcessing(data: FileProcessingData) {
    upsertFile(data.file, { status: 'processing', scenario: data.scenario })
  }

  function handlePassed(data: FilePassedData) {
    upsertFile(data.file, { status: 'passed', rows: data.rows, errors: [] })
  }

  function handleFailed(data: FileFailedData) {
    upsertFile(data.file, { status: 'failed', errors: data.errors.map((message) => ({ message })) })
  }

  function handleDone(data: Gate4DoneData) {
    overall.value = data.status === 'COMPLETED' ? 'passed' : 'failed'
    stop()
    options.onDone?.(overall.value)
  }

  function bindEvent<T>(name: string, handler: (data: T) => void) {
    source?.addEventListener(name, (e) => {
      try {
        handler(JSON.parse((e as MessageEvent).data) as T)
      } catch {
        error.value = 'Received a malformed message from the validation stream.'
      }
    })
  }

  function openRealStream() {
    closeSource()
    source = new EventSource(gate4StreamUrl(cohortId))
    bindEvent<FileProcessingData>('file.processing', handleProcessing)
    bindEvent<FilePassedData>('file.passed', handlePassed)
    bindEvent<FileFailedData>('file.failed', handleFailed)
    bindEvent<Gate4DoneData>('gate4.done', handleDone)
    source.onerror = () => {
      // EventSource reconnects on its own (Last-Event-ID replay) — just surface a soft warning.
      if (!disposed) error.value = 'Connection to the validation stream was interrupted — reconnecting…'
    }
  }

  const MOCK_FILES = ['Backend_Scores.xlsx', 'Frontend_Scores.xlsx']

  function runMock() {
    let i = 0
    const next = () => {
      if (disposed) return
      const file = MOCK_FILES[i]
      if (!file) {
        handleDone({ status: 'COMPLETED' })
        return
      }
      handleProcessing({ file, scenario: `Scenario ${i + 1}` })
      mockTimer = setTimeout(() => {
        if (disposed) return
        handlePassed({ file, rows: 40 + i * 5 })
        i += 1
        mockTimer = setTimeout(next, 300)
      }, 400)
    }
    next()
  }

  function start() {
    if (isPolling.value || disposed) return
    isPolling.value = true
    error.value = null
    overall.value = 'running'
    files.value = []
    if (USE_MOCKS) {
      runMock()
    } else {
      openRealStream()
    }
  }

  const errors = computed<LocatedError[]>(() => files.value.flatMap((f) => f.errors))

  onScopeDispose(() => {
    disposed = true
    closeSource()
    clearMockTimer()
  })

  return { files, overall, errors, isPolling, error, start, stop }
}
