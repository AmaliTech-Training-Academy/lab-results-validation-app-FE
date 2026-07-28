import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { StandupStatus } from '@/types/standup.types'
import {
  startCohortStandup,
  fetchStandupStatus,
  acceptCohortReference,
  discardCohortReference,
  triggerGate4,
} from '@/services/cohorts.service'

/**
 * Coordinates the stand-up job for the active cohort (FE strategy §7). The
 * per-gate polling itself lives in the `useJobPolling` composable, which calls
 * `refresh()`; this store holds the latest status and the lifecycle actions.
 */
export const useStandupStore = defineStore('standup', () => {
  const status = ref<StandupStatus | null>(null)
  const error = ref<string | null>(null)
  const busy = ref(false)

  async function start(cohortId: string, sharepointFolderUrl: string) {
    busy.value = true
    error.value = null
    try {
      await startCohortStandup(cohortId, { sharepointFolderUrl })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to start stand-up'
      throw e
    } finally {
      busy.value = false
    }
  }

  /** One status poll — returns the fresh status so callers (poller) can react. */
  async function refresh(cohortId: string): Promise<StandupStatus> {
    status.value = await fetchStandupStatus(cohortId)
    return status.value
  }

  async function accept(cohortId: string) {
    busy.value = true
    error.value = null
    try {
      await acceptCohortReference(cohortId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to accept reference data'
      throw e
    } finally {
      busy.value = false
    }
  }

  /** Triggers Gate 4 (empty score-sheet validation) — call once after accept() resolves. */
  async function runGate4(cohortId: string) {
    busy.value = true
    error.value = null
    try {
      await triggerGate4(cohortId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to start Gate 4 validation'
      throw e
    } finally {
      busy.value = false
    }
  }

  async function discard(cohortId: string) {
    busy.value = true
    error.value = null
    try {
      await discardCohortReference(cohortId)
      status.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to discard reference data'
      throw e
    } finally {
      busy.value = false
    }
  }

  function reset() {
    status.value = null
    error.value = null
  }

  return { status, error, busy, start, refresh, accept, runGate4, discard, reset }
})
