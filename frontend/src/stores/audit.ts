import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { IngestionRun } from '@/types/run.types'
import type { AuditEvent, AuditFilters } from '@/types/audit.types'
import type { Paged } from '@/types/common.types'
import { listAuditRuns, listAuditEvents, getAuditEvent } from '@/services/audit.service'

// Matches PAGE_SIZE_OPTIONS[0] (utils/pagination.ts) — the size selector's <select> shows the
// wrong option selected if this default isn't one of the actual choices offered.
const EVENTS_PAGE_SIZE = 10
const RUNS_PAGE_SIZE = 10

export const useAuditStore = defineStore('audit', () => {
  const runsPage = ref<Paged<IngestionRun> | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** See `fetchRuns` — kept here so a caller that omits `size` (e.g. a plain re-fetch) preserves
   *  whatever the admin last chose in the pager's rows-per-page select. */
  const runsPageSize = ref(RUNS_PAGE_SIZE)

  const eventsPage = ref<Paged<AuditEvent> | null>(null)
  const eventsLoading = ref(false)
  const eventsError = ref<string | null>(null)
  const eventsPageSize = ref(EVENTS_PAGE_SIZE)

  const filters = ref<AuditFilters>({})

  const currentEvent = ref<AuditEvent | null>(null)
  const currentEventLoading = ref(false)
  const currentEventError = ref<string | null>(null)

  // Bumped on every fetch so a slower, superseded request (e.g. the cohort filter changing again
  // before the previous page finished loading) can tell it's stale and not clobber newer state.
  let runsRequestId = 0
  let eventsRequestId = 0

  /** GET /audit-log/ingestion-runs is genuinely paginated server-side — paged independently of `eventsPage` so switching pages doesn't re-fetch the other tab. */
  async function fetchRuns(page = 0, size = runsPageSize.value) {
    runsPageSize.value = size
    const requestId = ++runsRequestId
    loading.value = true
    error.value = null
    try {
      const result = await listAuditRuns({ ...filters.value, page, size })
      if (requestId !== runsRequestId) return // a newer fetch already landed — don't overwrite it
      runsPage.value = result
    } catch (err) {
      if (requestId !== runsRequestId) return
      error.value = toErrorMessage(err, 'Failed to load runs')
    } finally {
      if (requestId === runsRequestId) loading.value = false
    }
  }

  async function fetchEvents(page = 0, size = eventsPageSize.value) {
    eventsPageSize.value = size
    const requestId = ++eventsRequestId
    eventsLoading.value = true
    eventsError.value = null
    try {
      const result = await listAuditEvents({ ...filters.value, page, size })
      if (requestId !== eventsRequestId) return
      eventsPage.value = result
    } catch (err) {
      if (requestId !== eventsRequestId) return
      eventsError.value = toErrorMessage(err, 'Failed to load events')
    } finally {
      if (requestId === eventsRequestId) eventsLoading.value = false
    }
  }

  async function fetch(next?: AuditFilters) {
    if (next) filters.value = next
    await Promise.all([fetchRuns(0), fetchEvents(0)])
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
    runsPage,
    runsPageSize,
    loading,
    error,
    fetchRuns,
    eventsPage,
    eventsPageSize,
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
