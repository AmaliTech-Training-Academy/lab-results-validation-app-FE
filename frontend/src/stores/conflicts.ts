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
      // Sum every cohort that responds instead of letting one bad cohort zero the whole KPI. Only
      // flag a full error when nothing usable came back at all — a partial success keeps its count
      // (blanking the whole dashboard over one unreachable cohort is worse than an only-slightly
      // understated "open conflicts" number).
      const settled = await Promise.allSettled(cohortIds.map((id) => listCohortConflicts(id, { status: 'PENDING', size: 1 })))
      const fulfilled = settled.filter(
        (s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof listCohortConflicts>>> => s.status === 'fulfilled',
      )
      totalOpen.value = fulfilled.reduce((sum, p) => sum + p.value.totalElements, 0)
      const rejected = settled.length - fulfilled.length
      if (rejected === settled.length) {
        error.value = toErrorMessage((settled[0] as PromiseRejectedResult).reason, 'Failed to load conflicts')
      }
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load conflicts')
    } finally {
      loading.value = false
    }
  }

  return { totalOpen, loading, error, fetchTotalOpen }
})
