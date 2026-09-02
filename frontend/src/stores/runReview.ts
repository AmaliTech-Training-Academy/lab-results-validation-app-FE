import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type {
  ConflictStatus,
  IngestionConflictResponse,
  Notification,
  NotificationStatus,
  RunReview,
  ResolveConflictPayload,
} from '@/types/runReview.types'
import type { Paged } from '@/types/common.types'
import {
  getRunReview,
  listConflicts as listConflictsApi,
  listNotifications as listNotificationsApi,
  resolveConflict as resolveConflictApi,
  dismissConflict as dismissConflictApi,
  sendNotification as sendNotificationApi,
  sendAllNotifications as sendAllApi,
  dismissNotification as dismissNotificationApi,
} from '@/services/runReview.service'

// Matches PAGE_SIZE_OPTIONS[0] (utils/pagination.ts) — the size selector's <select> shows the
// wrong option selected if this default isn't one of the actual choices offered.
const CONFLICTS_PAGE_SIZE = 10
const NOTIFICATIONS_PAGE_SIZE = 10

export const useRunReviewStore = defineStore('runReview', () => {
  const review = ref<RunReview | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const conflictsPage = ref<Paged<IngestionConflictResponse> | null>(null)
  const conflictsStatusFilter = ref<ConflictStatus | ''>('')
  const conflictsLoading = ref(false)
  const conflictsError = ref<string | null>(null)
  /** Kept here (not view-local) so an internal refetch that doesn't pass `size` explicitly — there
   *  isn't one today, but this mirrors `notificationsPageSize` below — still preserves whatever the
   *  admin last chose in the pager's rows-per-page select. */
  const conflictsPageSize = ref(CONFLICTS_PAGE_SIZE)

  const notificationsPage = ref<Paged<Notification> | null>(null)
  const notificationsStatusFilter = ref<NotificationStatus | ''>('')
  const notificationsLoading = ref(false)
  const notificationsError = ref<string | null>(null)
  /** See `conflictsPageSize` above — `sendAll`'s own refetch relies on this default to not silently
   *  reset the page size back to `NOTIFICATIONS_PAGE_SIZE`. */
  const notificationsPageSize = ref(NOTIFICATIONS_PAGE_SIZE)
  /** Set when a live stream event lands for this run but the row it touches isn't on the currently displayed
   *  page/filter — e.g. a fresh auto-dispatched notification, or one sitting on page 2 while page 1 is shown.
   *  Cleared by the next `fetchNotifications`. Patched rows that *are* visible update in place instead. */
  const notificationsStale = ref(false)

  // Bumped on every fetch so a slower, superseded request (e.g. Prev clicked right after Next, or the status
  // filter changed before the previous page finished loading) can tell it's stale and not clobber newer state.
  let conflictsRequestId = 0
  let notificationsRequestId = 0

  /** Fetches one page of the real conflict list (B10) — independent of `review`, which still carries the speculative merge-view `conflicts` array. */
  async function fetchConflicts(cohortId: string, runId: string, page = 0, size = conflictsPageSize.value) {
    conflictsPageSize.value = size
    const requestId = ++conflictsRequestId
    conflictsLoading.value = true
    conflictsError.value = null
    try {
      const result = await listConflictsApi(cohortId, runId, {
        status: conflictsStatusFilter.value || undefined,
        page,
        size,
      })
      if (requestId !== conflictsRequestId) return // a newer fetch already landed — don't overwrite it
      conflictsPage.value = result
    } catch (e) {
      if (requestId !== conflictsRequestId) return
      conflictsError.value = toErrorMessage(e, 'Failed to load conflicts')
    } finally {
      if (requestId === conflictsRequestId) conflictsLoading.value = false
    }
  }

  async function setConflictsStatusFilter(cohortId: string, runId: string, status: ConflictStatus | '') {
    conflictsStatusFilter.value = status
    await fetchConflicts(cohortId, runId, 0)
  }

  /** Fetches one page of the real, paginated notification list (GET /notifications) — independent of `review.notifications`, which is mock-only. */
  async function fetchNotifications(cohortId: string, runId: string, page = 0, size = notificationsPageSize.value) {
    notificationsPageSize.value = size
    const requestId = ++notificationsRequestId
    notificationsLoading.value = true
    notificationsError.value = null
    try {
      const result = await listNotificationsApi({
        cohortId,
        syncJobId: runId,
        status: notificationsStatusFilter.value || undefined,
        page,
        size,
      })
      if (requestId !== notificationsRequestId) return // a newer fetch already landed — don't overwrite it
      notificationsPage.value = result
      notificationsStale.value = false
    } catch (e) {
      if (requestId !== notificationsRequestId) return
      notificationsError.value = toErrorMessage(e, 'Failed to load notifications')
    } finally {
      if (requestId === notificationsRequestId) notificationsLoading.value = false
    }
  }

  async function setNotificationsStatusFilter(cohortId: string, runId: string, status: NotificationStatus | '') {
    notificationsStatusFilter.value = status
    await fetchNotifications(cohortId, runId, 0)
  }

  async function fetchReview(cohortId: string, runId: string) {
    loading.value = true
    error.value = null
    try {
      review.value = await getRunReview(cohortId, runId)
    } catch (e) {
      error.value = toErrorMessage(e, 'Failed to load run review')
    } finally {
      loading.value = false
    }
  }

  async function resolveConflict(cohortId: string, conflictId: string, payload: ResolveConflictPayload) {
    const updated = await resolveConflictApi(cohortId, conflictId, payload)
    replaceConflictRow(updated.id, updated)
  }

  async function dismissConflict(id: string) {
    const updated = await dismissConflictApi(id)
    replaceConflict(updated.id, updated)
  }

  /** Sending is async — the response only confirms the send was queued (status stays PENDING); the eventual SENT/FAILED outcome only shows up on a later refetch of the notifications list. */
  async function sendNotification(id: string) {
    const updated = await sendNotificationApi(id)
    replaceNotificationRow(updated.id, updated)
  }

  /**
   * Queues every PENDING/HELD notification for the job — the send-all endpoint returns 202 with just the
   * count queued; the actual sends happen off-thread, so this refetch is best-effort immediate feedback,
   * not the final outcome (statuses may still read PENDING until the caller re-checks).
   */
  async function sendAll(cohortId: string, runId: string) {
    const queued = await sendAllApi(runId)
    await fetchNotifications(cohortId, runId, notificationsPage.value?.number ?? 0)
    return queued
  }

  async function dismissNotification(id: string) {
    const updated = await dismissNotificationApi(id)
    replaceNotificationRow(updated.id, updated)
  }

  /**
   * Applies a notification.sent/failed/skipped event pushed over `useNotificationStream`. The stream is global
   * (every run, every cohort), so events for a different run are ignored outright; a matching event patches the
   * row in place if it's on the page currently displayed, otherwise it just flags `notificationsStale` so the
   * view can prompt a refresh rather than silently rewriting pagination/filter state out from under the admin.
   */
  function applyNotificationEvent(runId: string, n: Notification) {
    if (n.syncJobId !== runId && n.ingestionRunId !== runId) return
    const onPage = notificationsPage.value?.content.some((row) => row.id === n.id) ?? false
    if (onPage) {
      replaceNotificationRow(n.id, n)
    } else {
      notificationsStale.value = true
    }
  }

  function replaceConflict(id: string, next: RunReview['conflicts'][number]) {
    if (!review.value) return
    review.value.conflicts = review.value.conflicts.map((c) => (c.id === id ? next : c))
  }

  /** Patches a row in the real conflict-queue page (as opposed to the dead `review.conflicts` merge view). */
  function replaceConflictRow(id: string, next: IngestionConflictResponse) {
    if (!conflictsPage.value) return
    conflictsPage.value = {
      ...conflictsPage.value,
      content: conflictsPage.value.content.map((c) => (c.id === id ? next : c)),
    }
  }

  /** Patches a row in the real notification page (as opposed to the dead `review.notifications` merge view). */
  function replaceNotificationRow(id: string, next: Notification) {
    if (!notificationsPage.value) return
    notificationsPage.value = {
      ...notificationsPage.value,
      content: notificationsPage.value.content.map((n) => (n.id === id ? next : n)),
    }
  }

  return {
    review,
    loading,
    error,
    fetchReview,
    conflictsPage,
    conflictsPageSize,
    conflictsStatusFilter,
    conflictsLoading,
    conflictsError,
    fetchConflicts,
    setConflictsStatusFilter,
    notificationsPage,
    notificationsPageSize,
    notificationsStatusFilter,
    notificationsLoading,
    notificationsError,
    notificationsStale,
    fetchNotifications,
    setNotificationsStatusFilter,
    resolveConflict,
    dismissConflict,
    sendNotification,
    sendAll,
    dismissNotification,
    applyNotificationEvent,
  }
})
