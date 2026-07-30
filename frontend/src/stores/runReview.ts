import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RunReview, ResolveConflictPayload } from '@/types/runReview.types'
import {
  getRunReview,
  resolveConflict as resolveConflictApi,
  dismissConflict as dismissConflictApi,
  sendNotification as sendNotificationApi,
  sendAllNotifications as sendAllApi,
  dismissNotification as dismissNotificationApi,
} from '@/services/runReview.service'

export const useRunReviewStore = defineStore('runReview', () => {
  const review = ref<RunReview | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchReview(cohortId: string, runId: string) {
    loading.value = true
    error.value = null
    try {
      review.value = await getRunReview(cohortId, runId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load run review'
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
    resolveConflict,
    dismissConflict,
    sendNotification,
    sendAll,
    dismissNotification,
  }
})
