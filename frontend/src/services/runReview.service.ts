// Run-Review: conflict queue + staged-notification moderation
// (PRD Epic B B10, Epic C C7, FE strategy §8).
import { http } from './http'
import type { IngestionConflict, Notification, ResolveConflictPayload, RunReview } from '@/types/runReview.types'
import type { CohortSyncJobStatus, GradingSyncOverviewResponse, RunCounts, RunStatus } from '@/types/run.types'
import { USE_MOCKS, mockDelay, runs, conflicts, notifications } from './mock/fixtures'

const OVERVIEW_STATUS_MAP: Record<CohortSyncJobStatus, RunStatus> = {
  RUNNING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

/** A blank Total Score cell is informational, not a rejected row — don't surface it as an ingestion error. */
const NOT_AN_ERROR_RULES = new Set(['F1-BLANK-TOTAL-SCORE'])

function overviewCounts(o: GradingSyncOverviewResponse): RunCounts {
  return {
    rowsRead: o.rowsRead,
    committedNew: o.committedNew,
    updated: o.updatedCount,
    skippedInvalid: o.skippedInvalid,
    skippedUnchanged: o.skippedUnchanged,
    conflicts: o.conflictsCount,
  }
}

/** The overview endpoint reports counts + per-workbook breakdown only — conflicts/notifications have no list endpoint yet. */
function mapOverview(dto: GradingSyncOverviewResponse): RunReview {
  return {
    run: {
      id: dto.jobId,
      cohortId: dto.cohortId,
      status: OVERVIEW_STATUS_MAP[dto.jobStatus] ?? 'processing',
      counts: overviewCounts(dto),
      startedAt: dto.startedAt ?? undefined,
      completedAt: dto.completedAt ?? undefined,
      errorReport: (dto.issues ?? []).filter((i) => !NOT_AN_ERROR_RULES.has(i.rule ?? '')),
    },
    files: dto.files ?? [],
    conflicts: [],
    notifications: [],
  }
}

export async function getRunReview(cohortId: string, runId: string): Promise<RunReview> {
  if (USE_MOCKS) {
    const run = runs.find((r) => r.id === runId)
    if (!run) throw new Error('Run not found')
    return mockDelay({
      run,
      conflicts: conflicts.filter((c) => c.ingestionRunId === runId),
      notifications: notifications.filter((n) => n.ingestionRunId === runId),
    })
  }
  const dto = await http.get<GradingSyncOverviewResponse>(`/cohorts/${cohortId}/sync/runs/${runId}/overview`)
  return mapOverview(dto)
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
