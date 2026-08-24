import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { LocatedError } from '@/types/common.types'
import type {
  FileFailedData,
  FileGateResult,
  FilePassedData,
  FileProcessingData,
  Gate4DoneData,
} from '@/types/standup.types'
import { gate4StreamUrl } from '@/services/cohorts.service'
import { USE_MOCKS } from '@/services/mock/useMocks'
import { useEventSourceStream } from '@/composables/useEventSourceStream'

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
  /** True once reconnect attempts are exhausted — the stream has given up and needs a manual `start()`. */
  disconnected: Ref<boolean>
  start: () => void
  stop: () => void
  reset: () => void
}

/**
 * Drives Gate 4 (empty score-sheet validation) over the backend's own SSE
 * stream (§9d) — separate from the Gate 1-3 stream: after
 * `triggerGate4` triggers POST /gate4, this opens GET /gate4/stream and
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
  const disconnected = ref(false)

  const eventSource = useEventSourceStream()

  function stop() {
    isPolling.value = false
    eventSource.stop()
  }

  /** Stops the stream and clears file/overall state (Cancel / Discard). */
  function reset() {
    stop()
    overall.value = 'idle'
    files.value = []
    error.value = null
    disconnected.value = false
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

  function openRealStream() {
    const onMalformed = () => {
      error.value = 'Received a malformed message from the validation stream.'
    }
    const source = eventSource.open(gate4StreamUrl(cohortId))
    eventSource.bindEvent<FileProcessingData>('file.processing', handleProcessing, onMalformed)
    eventSource.bindEvent<FilePassedData>('file.passed', handlePassed, onMalformed)
    eventSource.bindEvent<FileFailedData>('file.failed', handleFailed, onMalformed)
    eventSource.bindEvent<Gate4DoneData>('gate4.done', handleDone, onMalformed)
    source.onerror = eventSource.withGiveUp(
      // EventSource reconnects on its own (Last-Event-ID replay) — just surface a soft warning.
      () => { error.value = 'Connection to the validation stream was interrupted — reconnecting…' },
      () => {
        isPolling.value = false
        disconnected.value = true
        error.value = 'Lost connection to the validation stream.'
      },
    )
  }

  const MOCK_FILES = ['Backend_Scores.xlsx', 'Frontend_Scores.xlsx']

  function runMock() {
    let i = 0
    const next = () => {
      if (eventSource.isDisposed()) return
      const file = MOCK_FILES[i]
      if (!file) {
        handleDone({ status: 'COMPLETED' })
        return
      }
      handleProcessing({ file, scenario: `Scenario ${i + 1}` })
      eventSource.scheduleMock(() => {
        if (eventSource.isDisposed()) return
        handlePassed({ file, rows: 40 + i * 5 })
        i += 1
        eventSource.scheduleMock(next, 300)
      }, 400)
    }
    next()
  }

  function start() {
    if (isPolling.value || eventSource.isDisposed()) return
    isPolling.value = true
    error.value = null
    disconnected.value = false
    overall.value = 'running'
    files.value = []
    if (USE_MOCKS) {
      runMock()
    } else {
      openRealStream()
    }
  }

  const errors = computed<LocatedError[]>(() => files.value.flatMap((f) => f.errors))

  return { files, overall, errors, isPolling, error, disconnected, start, stop, reset }
}
