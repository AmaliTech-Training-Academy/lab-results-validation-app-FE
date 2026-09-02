import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { StandupStatus } from '@/types/standup.types'
import {
  attachSharePointLink,
  fetchStandupStatus,
  hasStandupRun,
  hasGate4Run,
  acceptCohortReference,
  discardCohortReference,
  triggerGate4,
} from '@/services/cohorts.service'

/**
 * Coordinates the stand-up job for the active cohort (FE strategy §7). The
 * per-gate polling itself lives in `useStandupStream`, which calls
 * `refresh()`; this store holds the latest status and the lifecycle actions.
 */
export const useStandupStore = defineStore('standup', () => {
  const status = ref<StandupStatus | null>(null)
  const error = ref<string | null>(null)
  const busy = ref(false)
  const busyAction = ref<string | null>(null)
  const errors = ref({ start: null as string | null, discard: null as string | null, accept: null as string | null, gate4: null as string | null })

  /** Persists the folder link; the backend kicks off Gates 1-3 itself once it's attached. */
  async function start(cohortId: string, sharepointFolderUrl: string) {
    busy.value = true
    busyAction.value = 'start'
    error.value = null
    try {
      await attachSharePointLink(cohortId, { folderUrl: sharepointFolderUrl })
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to start stand-up')
      errors.value.start = error.value
      throw e
    } finally {
      busy.value = false
      busyAction.value = null
    }
  }

  /** FND-58: has a stand-up ever been run for this cohort? Used on mount to decide whether to
   *  re-attach the live Gates 1-3 stream (which replays its full history) instead of always
   *  falling back to the empty intake form. */
  async function hasRun(cohortId: string): Promise<boolean> {
    return hasStandupRun(cohortId)
  }

  /** FND-58: same idea as hasRun(), one step later — has Gate 4 ever been run for this cohort?
   *  Used on mount for a REFERENCE_ACCEPTED cohort to decide whether to re-attach the Gate 4 stream. */
  async function hasGate4(cohortId: string): Promise<boolean> {
    return hasGate4Run(cohortId)
  }

  /** One status poll — returns the fresh status so callers (poller) can react. */
  async function refresh(cohortId: string): Promise<StandupStatus> {
    error.value = null
    try {
      status.value = await fetchStandupStatus(cohortId)
      return status.value
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to refresh stand-up status')
      errors.value.start = error.value
      throw e
    }
  }

  async function accept(cohortId: string) {
    busy.value = true
    busyAction.value = 'accept'
    error.value = null
    try {
      await acceptCohortReference(cohortId)
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to accept reference data')
      errors.value.accept = error.value
      throw e
    } finally {
      busy.value = false
      busyAction.value = null
    }
  }

  /** Triggers Gate 4 (empty score-sheet validation) — call once after accept() resolves. */
  async function runGate4(cohortId: string) {
    busy.value = true
    busyAction.value = 'gate4'
    error.value = null
    try {
      await triggerGate4(cohortId)
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to start Gate 4 validation')
      errors.value.gate4 = error.value
      throw e
    } finally {
      busy.value = false
      busyAction.value = null
    }
  }

  async function discard(cohortId: string) {
    busy.value = true
    busyAction.value = 'discard'
    error.value = null
    try {
      await discardCohortReference(cohortId)
      status.value = null
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to discard reference data')
      errors.value.discard = error.value
      throw e
    } finally {
      busy.value = false
      busyAction.value = null
    }
  }

  function reset() {
    status.value = null
    error.value = null
  }

  return { status, error, busy, busyAction, errors, start, hasRun, hasGate4, refresh, accept, runGate4, discard, reset }
})
