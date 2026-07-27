import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Cohort, CreateCohortPayload } from '@/types/domain.types'
import {
  listCohorts,
  getCohort,
  createCohort as createCohortApi,
  lockCohort,
  unlockCohort,
} from '@/services/cohorts.service'

export const useCohortsStore = defineStore('cohorts', () => {
  const list = ref<Cohort[]>([])
  const current = ref<Cohort | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchList() {
    loading.value = true
    error.value = null
    try {
      list.value = await listCohorts()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load cohorts'
    } finally {
      loading.value = false
    }
  }

  async function fetchCohort(id: string) {
    loading.value = true
    error.value = null
    try {
      current.value = await getCohort(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load cohort'
    } finally {
      loading.value = false
    }
  }

  /** Returns the created cohort so the caller can route to its stand-up. Throws on failure. */
  async function createCohort(payload: CreateCohortPayload): Promise<Cohort> {
    const cohort = await createCohortApi(payload)
    list.value = [cohort, ...list.value]
    return cohort
  }

  async function lock(id: string) {
    await lockCohort(id)
    patch(id, { isLocked: true })
  }

  async function unlock(id: string) {
    await unlockCohort(id)
    patch(id, { isLocked: false })
  }

  function patch(id: string, changes: Partial<Cohort>) {
    const row = list.value.find((c) => c.id === id)
    if (row) Object.assign(row, changes)
    if (current.value?.id === id) Object.assign(current.value, changes)
  }

  return { list, current, loading, error, fetchList, fetchCohort, createCohort, lock, unlock }
})
