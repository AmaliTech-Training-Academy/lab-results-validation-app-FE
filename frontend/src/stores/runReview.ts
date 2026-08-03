import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toErrorMessage } from '@/utils/errors'
import type { ConflictStatus, IngestionConflictResponse, RunReview, ResolveConflictPayload } from '@/types/runReview.types'
import type { Paged } from '@/types/common.types'
import {
  getRunReview,
  listConflicts as listConflictsApi,
  resolveConflict as resolveConflictApi,
  dismissConflict as dismissConflictApi,
  sendNotification as sendNotificationApi,
  sendAllNotifications as sendAllApi,
  dismissNotification as dismissNotificationApi,
} from '@/services/runReview.service'

const CONFLICTS_PAGE_SIZE = 20

export const useRunReviewStore = defineStore('runReview', () => {
  const review = ref<RunReview | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const conflictsPage = ref<Paged<IngestionConflictResponse> | null>(null)
  const conflictsStatusFilter = ref<ConflictStatus | ''>('')
  const conflictsLoading = ref(false)
  const conflictsError = ref<string | null>(null)

  /** Fetches one page of the real conflict list (B10) — independent of `review`, which still carries the speculative merge-view `conflicts` array. */
  async function fetchConflicts(cohortId: string, runId: string, page = 0) {
    conflictsLoading.value = true
    conflictsError.value = null
    try {
      conflictsPage.value = await listConflictsApi(cohortId, runId, {
        status: conflictsStatusFilter.value || undefined,
        page,
        size: CONFLICTS_PAGE_SIZE,
      })
    } catch (e) {
      conflictsError.value = toErrorMessage(e, 'Failed to load conflicts')
    } finally {
      conflictsLoading.value = false
    }
  }

  async function setConflictsStatusFilter(cohortId: string, runId: string, status: ConflictStatus | '') {
    conflictsStatusFilter.value = status
    await fetchConflicts(cohortId, runId, 0)
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

  async function resolveConflict(id: string, payload: ResolveConflictPayload) {
    const updated = await resolveConflictApi(id, payload)
    replaceConflict(updated.id, updated)
  }

  async function dismissConflict(id: string) {
    const updated = await dismissConflictApi(id)
    replaceConflict(updated.id, updated)
  }

  async function sendNotification(id: string) {
    const updated = await sendNotificationApi(id)
    replaceNotification(updated.id, updated)
  }

  async function sendAll(runId: string) {
    const updated = await sendAllApi(runId)
    updated.forEach((n) => replaceNotification(n.id, n))
  }

  async function dismissNotification(id: string) {
    const updated = await dismissNotificationApi(id)
    replaceNotification(updated.id, updated)
  }

  function replaceConflict(id: string, next: RunReview['conflicts'][number]) {
    if (!review.value) return
    review.value.conflicts = review.value.conflicts.map((c) => (c.id === id ? next : c))
  }

  function replaceNotification(id: string, next: RunReview['notifications'][number]) {
    if (!review.value) return
    review.value.notifications = review.value.notifications.map((n) => (n.id === id ? next : n))
  }

  return {
    review,
    loading,
    error,
    fetchReview,
    conflictsPage,
    conflictsStatusFilter,
    conflictsLoading,
    conflictsError,
    fetchConflicts,
    setConflictsStatusFilter,
    resolveConflict,
    dismissConflict,
    sendNotification,
    sendAll,
    dismissNotification,
  }
})
