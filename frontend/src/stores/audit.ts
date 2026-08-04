import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { IngestionRun } from '@/types/run.types'
import type { AuditEvent, AuditFilters } from '@/types/audit.types'
import type { Paged } from '@/types/common.types'
import { listAuditRuns, listAuditEvents, getAuditEvent } from '@/services/audit.service'

const EVENTS_PAGE_SIZE = 20

export const useAuditStore = defineStore('audit', () => {
  const runs = ref<IngestionRun[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const eventsPage = ref<Paged<AuditEvent> | null>(null)
  const eventsLoading = ref(false)
  const eventsError = ref<string | null>(null)

  const filters = ref<AuditFilters>({})

  const currentEvent = ref<AuditEvent | null>(null)
  const currentEventLoading = ref(false)
  const currentEventError = ref<string | null>(null)

  async function fetchRuns() {
    loading.value = true
    error.value = null
    try {
      runs.value = await listAuditRuns(filters.value)
    } catch (err) {
      error.value = toErrorMessage(err, 'Failed to load runs')
    } finally {
      loading.value = false
    }
  }

  /** GET /audit-log/audit-events is genuinely paginated server-side — paged independently of `runs` so switching pages doesn't re-fetch them. */
  async function fetchEvents(page = 0) {
    eventsLoading.value = true
    eventsError.value = null
    try {
      eventsPage.value = await listAuditEvents({ ...filters.value, page, size: EVENTS_PAGE_SIZE })
    } catch (err) {
      eventsError.value = toErrorMessage(err, 'Failed to load events')
    } finally {
      eventsLoading.value = false
    }
  }

  async function fetch(next?: AuditFilters) {
    if (next) filters.value = next
    await Promise.all([fetchRuns(), fetchEvents(0)])
  }

  async function fetchEvent(id: string) {
    currentEventLoading.value = true
    currentEventError.value = null
    try {
      currentEvent.value = await getAuditEvent(id)
    } catch (err) {
      currentEventError.value = toErrorMessage(err, 'Failed to load event')
    } finally {
      currentEventLoading.value = false
    }
  }

  return {
    runs,
    loading,
    error,
    eventsPage,
    eventsLoading,
    eventsError,
    filters,
    fetch,
    fetchEvents,
    currentEvent,
    currentEventLoading,
    currentEventError,
    fetchEvent,
  }
})
