import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import { listCohortConflicts } from '@/services/runReview.service'

/** Total open (PENDING) conflicts across every cohort — powers the "Open Conflicts" dashboard KPI. */
export const useConflictsStore = defineStore('conflicts', () => {
  const totalOpen = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** Fetches each cohort's conflicts (path-scoped by cohort id) in parallel and sums their totals. */
  async function fetchTotalOpen(cohortIds: string[]) {
    if (cohortIds.length === 0) {
      totalOpen.value = 0
      return
    }
    loading.value = true
    error.value = null
    try {
      const pages = await Promise.all(cohortIds.map((id) => listCohortConflicts(id, { status: 'PENDING', size: 1 })))
      totalOpen.value = pages.reduce((sum, p) => sum + p.totalElements, 0)
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load conflicts')
    } finally {
      loading.value = false
    }
  }

  return { totalOpen, loading, error, fetchTotalOpen }
})
