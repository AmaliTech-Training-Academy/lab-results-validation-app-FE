// Run-Review: conflict queue + staged-notification moderation
// (PRD Epic B B10, Epic C C7, FE strategy §8).
import { http } from './http'
import type { IngestionConflict, Notification, ResolveConflictPayload, RunReview } from '@/types/runReview.types'
import { USE_MOCKS, mockDelay, runs, conflicts, notifications } from './mock/fixtures'

export async function getRunReview(runId: string): Promise<RunReview> {
  if (USE_MOCKS) {
    const run = runs.find((r) => r.id === runId)
    if (!run) throw new Error('Run not found')
    return mockDelay({
      run,
      conflicts: conflicts.filter((c) => c.ingestionRunId === runId),
      notifications: notifications.filter((n) => n.ingestionRunId === runId),
    })
  }
  return http.get<RunReview>(`/runs/${runId}/review`)
}

export async function resolveConflict(id: string, payload: ResolveConflictPayload): Promise<IngestionConflict> {
  if (USE_MOCKS) {
    const c = conflicts.find((x) => x.id === id)
    if (!c) throw new Error('Conflict not found')
    c.status = 'RESOLVED'
    c.resolutionNote = payload.note
    return mockDelay(c)
  }
  return http.post<IngestionConflict>(`/conflicts/${id}/resolve`, payload)
}

export async function dismissConflict(id: string): Promise<IngestionConflict> {
  if (USE_MOCKS) {
    const c = conflicts.find((x) => x.id === id)
    if (!c) throw new Error('Conflict not found')
    c.status = 'DISMISSED'
    return mockDelay(c)
  }
  return http.post<IngestionConflict>(`/conflicts/${id}/dismiss`)
}

export async function sendNotification(id: string): Promise<Notification> {
  if (USE_MOCKS) {
    const n = notifications.find((x) => x.id === id)
    if (!n) throw new Error('Notification not found')
    if (n.status === 'PENDING' || n.status === 'FAILED') {
      n.status = 'SENT'
      n.sentAt = new Date().toISOString()
    }
    return mockDelay(n)
  }
  return http.post<Notification>(`/notifications/${id}/send`)
}

/** Send-all touches only PENDING items — SENT/SKIPPED are untouched (C7 AC2, idempotent). */
export async function sendAllNotifications(runId: string): Promise<Notification[]> {
  if (USE_MOCKS) {
    const now = new Date().toISOString()
    const affected = notifications.filter((n) => n.ingestionRunId === runId && n.status === 'PENDING')
    affected.forEach((n) => {
      n.status = 'SENT'
      n.sentAt = now
    })
    return mockDelay(affected)
  }
  return http.post<Notification[]>(`/runs/${runId}/notifications/send-all`)
}

export async function dismissNotification(id: string): Promise<Notification> {
  if (USE_MOCKS) {
    const n = notifications.find((x) => x.id === id)
    if (!n) throw new Error('Notification not found')
    if (n.status === 'PENDING') n.status = 'SKIPPED'
    return mockDelay(n)
  }
  return http.post<Notification>(`/notifications/${id}/dismiss`)
}
