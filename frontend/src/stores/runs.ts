import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { IngestionRun, SyncTriggerPayload } from '@/types/run.types'
import { listRuns, getRun, triggerSync, triggerSyncAll } from '@/services/runs.service'
import { useCohortsStore } from '@/stores/cohorts'

export const useRunsStore = defineStore('runs', () => {
  const list = ref<IngestionRun[]>([])
  const current = ref<IngestionRun | null>(null)
  const loading = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)

  /**
   * `listRuns` is scoped to one cohort (§9c) — there's no "all runs" endpoint.
   * With no `cohortId`, fan out over every STOOD_UP cohort and merge, so the
   * dashboard/"All cohorts" views keep working exactly as before.
   */
  async function fetchList(cohortId?: string) {
    loading.value = true
    error.value = null
    try {
      if (cohortId) {
        list.value = await listRuns(cohortId)
      } else {
        const cohorts = useCohortsStore()
        if (cohorts.list.length === 0) await cohorts.fetchList()
        const eligible = cohorts.list.filter((c) => c.lifecycleState === 'STOOD_UP')
        const perCohort = await Promise.all(eligible.map((c) => listRuns(c.id)))
        list.value = perCohort
          .flat()
          .sort((a, b) => (b.runAt ?? b.startedAt ?? '').localeCompare(a.runAt ?? a.startedAt ?? ''))
      }
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load runs')
    } finally {
      loading.value = false
    }
  }

  async function fetchRun(cohortId: string, id: string) {
    loading.value = true
    error.value = null
    try {
      current.value = await getRun(cohortId, id)
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load run')
    } finally {
      loading.value = false
    }
  }

  /**
   * Trigger a manual sync, then re-list to pick up the new run(s) — the
   * trigger endpoints only return a summary (cohorts triggered/skipped), not
   * the created run rows. With no `cohortId`, fans out to every eligible
   * cohort via the all-cohorts endpoint.
   */
  async function sync(cohortId?: string, payload: SyncTriggerPayload = {}) {
    syncing.value = true
    error.value = null
    try {
      const result = cohortId ? await triggerSync(cohortId, payload) : await triggerSyncAll()
      await fetchList(cohortId)
      return result
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to trigger sync')
      throw e
    } finally {
      syncing.value = false
    }
  }

  return { list, current, loading, syncing, error, fetchList, fetchRun, sync }
})
