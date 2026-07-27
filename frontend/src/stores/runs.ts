import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { IngestionRun, SyncTriggerPayload } from '@/types/run.types'
import { listRuns, getRun, triggerSync } from '@/services/runs.service'

export const useRunsStore = defineStore('runs', () => {
  const list = ref<IngestionRun[]>([])
  const current = ref<IngestionRun | null>(null)
  const loading = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)

  async function fetchList(cohortId?: string) {
    loading.value = true
    error.value = null
    try {
      list.value = await listRuns(cohortId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load runs'
    } finally {
      loading.value = false
    }
  }

  async function fetchRun(id: string) {
    loading.value = true
    error.value = null
    try {
      current.value = await getRun(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load run'
    } finally {
      loading.value = false
    }
  }

  /** Trigger a manual sync, then prepend the new run(s) to the list. */
  async function sync(payload: SyncTriggerPayload = {}) {
    syncing.value = true
    error.value = null
    try {
      const started = await triggerSync(payload)
      list.value = [...started, ...list.value]
      return started
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to trigger sync'
      throw e
    } finally {
      syncing.value = false
    }
  }

  return { list, current, loading, syncing, error, fetchList, fetchRun, sync }
})
