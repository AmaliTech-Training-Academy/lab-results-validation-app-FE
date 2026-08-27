import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { LocatedError } from '@/types/common.types'
import type { ReferenceBundleSummary } from '@/types/domain.types'
import type {
  Gate,
  GateId,
  GateFailedData,
  GatePassedData,
  PipelineDoneData,
  StandupOverall,
  StandupStatus,
} from '@/types/standup.types'
import { fetchStandupStatus, standupStreamUrl } from '@/services/cohorts.service'
import { USE_MOCKS } from '@/services/mock/useMocks'
import { useEventSourceStream } from '@/composables/useEventSourceStream'

/**
 * Drives Gates 1-3 of the stand-up pipeline over the backend SSE stream
 * (§9b): after `attachSharePointLink` persists the link (which kicks the job
 * off on the backend), this opens GET /standup/stream and turns
 * gate.passed / gate.failed / pipeline.done
 * events into the same `StandupStatus` shape the view already renders — the
 * stream closes itself after `pipeline.done`, at which point Gate 4 takes
 * over via a `fetchStandupStatus` poll (the stream has no concept of
 * post-accept gates).
 *
 * There's no fake SSE server for local dev, so mock mode instead polls the
 * mock status endpoint on a fast interval and stops at the same terminal
 * point (Gate 3 resolved, awaiting Accept).
 */

const PRE_GATES: GateId[] = ['gate1', 'gate2', 'gate3']
const GATE_ORDER: GateId[] = ['gate1', 'gate2', 'gate3', 'accept', 'gate4']

const LABELS: Record<GateId, string> = {
  gate1: 'Gate 1 — Link',
  gate2: 'Gate 2 — Folders',
  gate3: 'Gate 3 — Reference files',
  accept: 'Accept',
  gate4: 'Gate 4 — Empty score sheets',
}

function emptyGates(): Gate[] {
  return GATE_ORDER.map((id) => ({ id, label: LABELS[id], status: 'pending', errors: [] }))
}

function gateIdFor(n: number): GateId {
  return PRE_GATES[n - 1] ?? 'gate1'
}

export interface StandupStream {
  status: Ref<StandupStatus | null>
  gates: ComputedRef<Gate[]>
  errors: ComputedRef<LocatedError[]>
  isPolling: Ref<boolean>
  error: Ref<string | null>
  /** True once reconnect attempts are exhausted — the stream has given up and needs a manual `start()`. */
  disconnected: Ref<boolean>
  start: () => void
  stop: () => void
  reset: () => void
}

export function useStandupStream(cohortId: string): StandupStream {
  const status = ref<StandupStatus | null>(null) as Ref<StandupStatus | null>
  const isPolling = ref(false)
  const error = ref<string | null>(null)
  const disconnected = ref(false)

  const eventSource = useEventSourceStream()

  function stop() {
    isPolling.value = false
    eventSource.stop()
  }

  /** Stops the stream and clears status so `started` goes back to false (Cancel / Discard). */
  function reset() {
    stop()
    status.value = null
    error.value = null
    disconnected.value = false
  }

  function setGate(id: GateId, patch: Partial<Gate>) {
    const current = status.value ?? { overall: 'running' as StandupOverall, gates: emptyGates() }
    const gates = current.gates.map((g) => (g.id === id ? { ...g, ...patch } : g))
    status.value = { ...current, gates }
  }

  function markNotRun(from: GateId) {
    if (!status.value) return
    const rest = new Set(GATE_ORDER.slice(GATE_ORDER.indexOf(from) + 1))
    const gates = status.value.gates.map((g) => (rest.has(g.id) ? { ...g, status: 'not_run' as const } : g))
    status.value = { ...status.value, gates }
  }

  function finish(overall: StandupOverall, acceptSummary?: ReferenceBundleSummary) {
    const current = status.value ?? { overall, gates: emptyGates() }
    status.value = { ...current, overall, acceptSummary: acceptSummary ?? current.acceptSummary }
    stop()
  }

  function handlePassed(data: GatePassedData) {
    const id = gateIdFor(data.gate)
    setGate(id, { status: 'passed', errors: [] })
    const next = PRE_GATES[PRE_GATES.indexOf(id) + 1]
    if (next) setGate(next, { status: 'running' })
  }

  function handleFailed(data: GateFailedData) {
    const id = gateIdFor(data.gate)
    // data.errors is already LocatedError[] (the backend's GateError record, {file, location, rule,
    // message}) — unlike Gate 4's file.failed, gates 1-3 don't pre-flatten to plain strings.
    setGate(id, { status: 'failed', errors: data.errors })
    markNotRun(id)
  }

  function handleDone(data: PipelineDoneData) {
    if (data.status === 'COMPLETED') {
      finish('passed', {
        specializations: data.specs ?? 0,
        modules: data.modules ?? 0,
        labs: data.labs ?? 0,
        learners: data.learners ?? 0,
        quizReferencePresent: data.quizReferencePresent ?? false,
      })
    } else {
      finish('failed')
    }
  }

  function openRealStream() {
    const onMalformed = () => {
      error.value = 'Received a malformed message from the validation stream.'
    }
    const source = eventSource.open(standupStreamUrl(cohortId), () => {
      // A browser-initiated reconnect succeeded (or this is the first connect) — drop any stale
      // "interrupted — reconnecting…" message now that the stream is live again.
      error.value = null
      disconnected.value = false
    })
    eventSource.bindEvent<GatePassedData>('gate.passed', handlePassed, onMalformed)
    eventSource.bindEvent<GateFailedData>('gate.failed', handleFailed, onMalformed)
    eventSource.bindEvent<PipelineDoneData>('pipeline.done', handleDone, onMalformed)
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

  function mockTick() {
    if (eventSource.isDisposed()) return
    fetchStandupStatus(cohortId)
      .then((next) => {
        if (eventSource.isDisposed()) return
        status.value = next
        error.value = null
        if (next.overall === 'passed' || next.overall === 'failed') {
          stop()
          return
        }
        eventSource.scheduleMock(mockTick, 400)
      })
      .catch((e) => {
        if (eventSource.isDisposed()) return
        error.value = toErrorMessage(e, 'Failed to fetch stand-up status')
        eventSource.scheduleMock(mockTick, 400)
      })
  }

  function start() {
    if (isPolling.value || eventSource.isDisposed()) return
    isPolling.value = true
    error.value = null
    disconnected.value = false
    status.value = { overall: 'running', gates: emptyGates() }
    if (USE_MOCKS) {
      mockTick()
    } else {
      openRealStream()
    }
  }

  const gates = computed<Gate[]>(() => status.value?.gates ?? [])
  const errors = computed<LocatedError[]>(() => gates.value.flatMap((g) => g.errors))

  return { status, gates, errors, isPolling, error, disconnected, start, stop, reset }
}
