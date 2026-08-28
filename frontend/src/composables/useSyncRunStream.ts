import { ref, type Ref } from 'vue'
import type {
  SyncDoneData,
  SyncFileArchivedData,
  SyncFileArchiveFailedData,
  SyncFileChangedData,
  SyncFileDiscoveredData,
  SyncFileFailedData,
  SyncFileResult,
  SyncFileUnchangedData,
  SyncFolderFailedData,
} from '@/types/run.types'
import { syncRunStreamUrl } from '@/services/runs.service'
import { USE_MOCKS } from '@/services/mock/useMocks'
import { useEventSourceStream } from '@/composables/useEventSourceStream'

export type StreamErrorKind = 'malformed' | 'reconnecting' | 'lost'

export type SyncRunOverall = 'idle' | 'running' | 'passed' | 'failed'

export interface UseSyncRunStreamOptions {
  /** Called once when sync.done arrives (or the mock equivalent resolves). */
  onDone?: (overall: SyncRunOverall) => void
}

export interface SyncRunStream {
  files: Ref<SyncFileResult[]>
  folderErrors: Ref<SyncFolderFailedData[]>
  summary: Ref<SyncDoneData | null>
  overall: Ref<SyncRunOverall>
  isPolling: Ref<boolean>
  error: Ref<string | null>
  /** Classifies `error` — `'malformed'`/`'reconnecting'` are transient (the former self-clears on the
   *  next good event, the latter once the browser reconnects); `'lost'` is terminal, mirrors `disconnected`. */
  errorKind: Ref<StreamErrorKind | null>
  /** True once reconnect attempts are exhausted — the stream has given up and needs a manual `start()`. */
  disconnected: Ref<boolean>
  start: () => void
  stop: () => void
  reset: () => void
}

/**
 * Drives the live processing state on the run-review page over the
 * CohortSyncJobRunner's SSE stream (GET /cohorts/{cohortId}/sync/stream) —
 * scoped to the cohort, not a specific run: it streams the most recent sync
 * job for that cohort, replaying all stored events on a fresh connection
 * (Last-Event-ID+1 on reconnect). This is only safe to open while the run
 * we're viewing genuinely is that cohort's most recent job, which is what
 * the "processing" gate in RunReviewView guarantees. file.discovered seeds a
 * row per workbook, then file.unchanged / file.changed+file.archived /
 * file.failed / file.archive_failed resolve it, folder.failed surfaces a
 * subfolder-level error, and sync.done is always last. There's no fake SSE
 * server for local dev, so mock mode simulates one unchanged file and one
 * changed-then-archived file, mutating the shared `runs` fixture (keyed by
 * `runId`) in place so the follow-up `getRunReview` call (fired from the
 * view's `onDone` callback) sees consistent completed data.
 */
export function useSyncRunStream(cohortId: string, runId: string, options: UseSyncRunStreamOptions = {}): SyncRunStream {
  const files = ref<SyncFileResult[]>([]) as Ref<SyncFileResult[]>
  const folderErrors = ref<SyncFolderFailedData[]>([]) as Ref<SyncFolderFailedData[]>
  const summary = ref<SyncDoneData | null>(null) as Ref<SyncDoneData | null>
  const overall = ref<SyncRunOverall>('idle')
  const isPolling = ref(false)
  const error = ref<string | null>(null)
  const errorKind = ref<StreamErrorKind | null>(null)
  const disconnected = ref(false)

  const eventSource = useEventSourceStream()

  function stop() {
    isPolling.value = false
    eventSource.stop()
  }

  /** Stops the stream and clears file/summary state. */
  function reset() {
    stop()
    overall.value = 'idle'
    files.value = []
    folderErrors.value = []
    summary.value = null
    error.value = null
    errorKind.value = null
    disconnected.value = false
  }

  function findFileIndex(data: { file?: string; itemId?: string }): number {
    if (data.file) {
      const idx = files.value.findIndex((f) => f.file === data.file)
      if (idx !== -1) return idx
    }
    if (data.itemId) return files.value.findIndex((f) => f.itemId === data.itemId)
    return -1
  }

  function upsertFile(data: { file?: string; itemId?: string }, patch: Partial<SyncFileResult>) {
    const idx = findFileIndex(data)
    if (idx === -1) {
      files.value = [...files.value, { file: data.file ?? data.itemId ?? 'Unknown file', itemId: data.itemId, status: 'discovered', ...patch }]
    } else {
      files.value = files.value.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    }
  }

  function handleDiscovered(data: SyncFileDiscoveredData) {
    upsertFile(data, { file: data.file, itemId: data.itemId, status: 'discovered' })
  }

  function handleUnchanged(data: SyncFileUnchangedData) {
    upsertFile(data, { status: 'unchanged' })
  }

  function handleChanged(data: SyncFileChangedData) {
    upsertFile(data, { status: 'changed', state: data.state })
  }

  function handleArchived(data: SyncFileArchivedData) {
    upsertFile(data, { status: 'archived', state: data.state })
  }

  function handleFailed(data: SyncFileFailedData) {
    upsertFile(data, { status: 'failed', error: data.error })
  }

  function handleArchiveFailed(data: SyncFileArchiveFailedData) {
    upsertFile(data, { status: 'archive_failed', error: data.error })
  }

  function handleFolderFailed(data: SyncFolderFailedData) {
    folderErrors.value = [...folderErrors.value, data]
  }

  function handleDone(data: SyncDoneData) {
    summary.value = data
    overall.value = data.status === 'COMPLETED' ? 'passed' : 'failed'
    stop()
    options.onDone?.(overall.value)
  }

  function openRealStream() {
    const onMalformed = () => {
      error.value = 'Received a malformed message from the sync stream.'
      errorKind.value = 'malformed'
    }
    // Once a later event parses and handles cleanly, drop that malformed-message warning — it was
    // about one bad message, not the connection.
    const onRecovered = () => {
      error.value = null
      errorKind.value = null
    }
    const source = eventSource.open(syncRunStreamUrl(cohortId), () => {
      // A browser-initiated reconnect succeeded (or this is the first connect) — drop any stale
      // "interrupted — reconnecting…" message now that the stream is live again.
      error.value = null
      errorKind.value = null
      disconnected.value = false
    })
    eventSource.bindEvent<SyncFileDiscoveredData>('file.discovered', handleDiscovered, onMalformed, onRecovered)
    eventSource.bindEvent<SyncFileUnchangedData>('file.unchanged', handleUnchanged, onMalformed, onRecovered)
    eventSource.bindEvent<SyncFileChangedData>('file.changed', handleChanged, onMalformed, onRecovered)
    eventSource.bindEvent<SyncFileArchivedData>('file.archived', handleArchived, onMalformed, onRecovered)
    eventSource.bindEvent<SyncFileFailedData>('file.failed', handleFailed, onMalformed, onRecovered)
    eventSource.bindEvent<SyncFileArchiveFailedData>('file.archive_failed', handleArchiveFailed, onMalformed, onRecovered)
    eventSource.bindEvent<SyncFolderFailedData>('folder.failed', handleFolderFailed, onMalformed, onRecovered)
    eventSource.bindEvent<SyncDoneData>('sync.done', handleDone, onMalformed, onRecovered)
    source.onerror = eventSource.withGiveUp(
      // EventSource reconnects on its own (Last-Event-ID replay) — just surface a soft warning.
      () => {
        error.value = 'Connection to the sync stream was interrupted — reconnecting…'
        errorKind.value = 'reconnecting'
      },
      () => {
        isPolling.value = false
        disconnected.value = true
        error.value = 'Lost connection to the sync stream.'
        errorKind.value = 'lost'
      },
    )
  }

  function finishMock(mockRuns: (typeof import('@/services/mock/fixtures'))['runs']) {
    const changed = files.value.filter((f) => f.status === 'archived').length
    const unchanged = files.value.filter((f) => f.status === 'unchanged').length
    const failed = files.value.filter((f) => f.status === 'failed' || f.status === 'archive_failed').length
    const data: SyncDoneData = {
      cohortName: '',
      filesSeen: files.value.length,
      new: 0,
      changed,
      unchanged,
      failed,
      status: failed > 0 ? 'FAILED' : 'COMPLETED',
    }
    const run = mockRuns.find((r) => r.id === runId)
    if (run) {
      run.status = data.status === 'COMPLETED' ? 'completed' : 'failed'
      run.counts = {
        rowsRead: 40,
        committedNew: data.new,
        updated: data.changed,
        skippedInvalid: 0,
        skippedUnchanged: data.unchanged,
        conflicts: 0,
      }
    }
    handleDone(data)
  }

  async function runMock() {
    let mockRuns: typeof import('@/services/mock/fixtures').runs
    try {
      ;({ runs: mockRuns } = await import('@/services/mock/fixtures'))
    } catch {
      error.value = 'Mock mode failed to load. Please try again.'
      disconnected.value = false
      overall.value = 'failed'
      return
    }
    const steps: Array<() => void> = [
      () => handleDiscovered({ file: 'BE_Lab_Grading.xlsx', itemId: 'item-1', versionId: '1.0', quickXorHash: 'hash-1' }),
      () => handleUnchanged({ file: 'BE_Lab_Grading.xlsx' }),
      () => handleDiscovered({ file: 'FE_Lab_Grading.xlsx', itemId: 'item-2', versionId: '2.0', quickXorHash: 'hash-2' }),
      () => handleChanged({ file: 'FE_Lab_Grading.xlsx', state: 'MODIFIED', sheets: ['Scenario 1'] }),
      () => handleArchived({ file: 'FE_Lab_Grading.xlsx', s3Key: 'mock/FE_Lab_Grading.xlsx', versionId: '2.0', state: 'MODIFIED' }),
    ]
    let i = 0
    const next = () => {
      if (eventSource.isDisposed()) return
      const step = steps[i]
      if (!step) {
        finishMock(mockRuns)
        return
      }
      step()
      i += 1
      eventSource.scheduleMock(next, 350)
    }
    next()
  }

  function start() {
    if (isPolling.value || eventSource.isDisposed()) return
    isPolling.value = true
    error.value = null
    errorKind.value = null
    disconnected.value = false
    overall.value = 'running'
    files.value = []
    folderErrors.value = []
    summary.value = null
    if (USE_MOCKS) {
      void runMock()
    } else {
      openRealStream()
    }
  }

  return { files, folderErrors, summary, overall, isPolling, error, errorKind, disconnected, start, stop, reset }
}
