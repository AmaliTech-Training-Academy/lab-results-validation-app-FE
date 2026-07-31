import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { IngestionRun } from '@/types/run.types'
import type { AuditEvent, AuditFilters } from '@/types/audit.types'
import { listAuditRuns, listAuditEvents } from '@/services/audit.service'

export const useAuditStore = defineStore('audit', () => {
  const runs = ref<IngestionRun[]>([])
  const events = ref<AuditEvent[]>([])
  const filters = ref<AuditFilters>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch(next?: AuditFilters) {
    if (next) filters.value = next
    loading.value = true
    error.value = null
    try {
      const [r, e] = await Promise.all([
        listAuditRuns(filters.value),
        listAuditEvents(filters.value),
      ])
      runs.value = r
      events.value = e
    } catch (err) {
      error.value = toErrorMessage(err, 'Failed to load audit log')
    } finally {
      loading.value = false
    }
  }

  return { runs, events, filters, loading, error, fetch }
})
