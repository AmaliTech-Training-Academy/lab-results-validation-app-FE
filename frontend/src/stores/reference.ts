import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { CohortReference } from '@/types/domain.types'
import { getCohortReference } from '@/services/cohorts.service'

/** Read-only committed reference hierarchy for a cohort (FE strategy §6.3 / §7). */
export const useReferenceStore = defineStore('reference', () => {
  const reference = ref<CohortReference | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchReference(cohortId: string) {
    loading.value = true
    error.value = null
    try {
      reference.value = await getCohortReference(cohortId)
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load reference data')
    } finally {
      loading.value = false
    }
  }

  return { reference, loading, error, fetchReference }
})
