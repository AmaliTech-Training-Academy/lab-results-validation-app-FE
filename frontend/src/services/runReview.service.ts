// Run-Review: conflict queue + staged-notification moderation
// (PRD Epic B B10, Epic C C7, FE strategy §8).
import { http, BASE_URL, getToken } from './http'
import type {
  ConflictListFilters,
  IngestionConflict,
  IngestionConflictResponse,
  Notification,
  NotificationListFilters,
  NotificationResponse,
  ResolveConflictPayload,
  RunReview,
} from '@/types/runReview.types'
import type { CohortSyncJobStatus, GradingSyncOverviewResponse, RunCounts, RunStatus } from '@/types/run.types'
import type { LocatedError, Paged } from '@/types/common.types'
import { USE_MOCKS } from './mock/useMocks'
import { getInstructor } from './instructors.service'

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

function isRealIssue(i: LocatedError): boolean {
  return !NOT_AN_ERROR_RULES.has(i.rule ?? '')
}

/** The overview endpoint reports counts + per-workbook breakdown only — conflicts/notifications have no list endpoint yet. */
function mapOverview(dto: GradingSyncOverviewResponse): RunReview {
  // Multi-file jobs only report issues per file (not at the top level) — `dto.issues` is absent in that case.
  const files = (dto.files ?? []).map((f) => ({ ...f, issues: (f.issues ?? []).filter(isRealIssue) }))
  const errorReport = files.length ? files.flatMap((f) => f.issues) : (dto.issues ?? []).filter(isRealIssue)

  return {
    run: {
      id: dto.jobId,
      cohortId: dto.cohortId,
      status: OVERVIEW_STATUS_MAP[dto.jobStatus] ?? 'processing',
      counts: overviewCounts(dto),
      startedAt: dto.startedAt ?? undefined,
      completedAt: dto.completedAt ?? undefined,
      errorReport,
    },
    files,
    conflicts: [],
    notifications: [],
  }
}

export async function getRunReview(cohortId: string, runId: string): Promise<RunReview> {
  if (USE_MOCKS) {
    const { mockDelay, runs, conflicts, notifications } = await import('./mock/fixtures')
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

/** Newest-first, in-file duplicates held for manual resolution during grading ingestion (B10). */
export async function listConflicts(
  cohortId: string,
  runId: string,
  filters: ConflictListFilters = {},
): Promise<Paged<IngestionConflictResponse>> {
  if (USE_MOCKS) {
    const { mockDelay, ingestionConflictResponses } = await import('./mock/fixtures')
    const list = ingestionConflictResponses
      .filter((c) => c.ingestionRunId === runId && (!filters.status || c.status === filters.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const size = filters.size ?? 20
    const page = filters.page ?? 0
    const start = page * size
    const content = list.slice(start, start + size)
    return mockDelay({
      content,
      number: page,
      size,
      totalElements: list.length,
      totalPages: Math.max(1, Math.ceil(list.length / size)),
      last: start + size >= list.length,
    })
  }
  return http.get<Paged<IngestionConflictResponse>>(
    `/cohorts/${cohortId}/sync/runs/${runId}/conflicts${buildConflictsQuery(filters)}`,
  )
}

function buildConflictsQuery(filters: ConflictListFilters): string {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.page !== undefined) params.set('page', String(filters.page))
  if (filters.size !== undefined) params.set('size', String(filters.size))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Resolves a held in-file duplicate conflict (B10): keep the existing row, keep the incoming row, or reject both. */
export async function resolveConflict(
  cohortId: string,
  conflictId: string,
  payload: ResolveConflictPayload,
): Promise<IngestionConflictResponse> {
  if (USE_MOCKS) {
    const { mockDelay, ingestionConflictResponses } = await import('./mock/fixtures')
    const c = ingestionConflictResponses.find((x) => x.id === conflictId)
    if (!c) throw new Error('Conflict not found')
    c.status = payload.action === 'REJECT' ? 'DISMISSED' : 'RESOLVED'
    c.resolutionNote = payload.note ?? null
    c.resolvedBy = 'you@amalitech.com'
    c.resolvedAt = new Date().toISOString()
    return mockDelay(c)
  }
  return http.patch<IngestionConflictResponse>(`/cohorts/${cohortId}/conflicts/${conflictId}/resolve`, payload)
}

export async function dismissConflict(id: string): Promise<IngestionConflict> {
  if (USE_MOCKS) {
    const { mockDelay, conflicts } = await import('./mock/fixtures')
    const c = conflicts.find((x) => x.id === id)
    if (!c) throw new Error('Conflict not found')
    c.status = 'DISMISSED'
    return mockDelay(c)
  }
  return http.post<IngestionConflict>(`/conflicts/${id}/dismiss`)
}

/** The real endpoint reports recipients as ids only — `enrichRecipients` fills in `recipientName`/`recipientEmail` via GET /instructors/{id}. */
function mapNotification(dto: NotificationResponse): Notification {
  return {
    id: dto.id,
    ingestionRunId: dto.ingestionRunId,
    cohortId: dto.cohortId,
    syncJobId: dto.syncJobId,
    type: dto.type as Notification['type'],
    recipientKind: dto.recipientKind as Notification['recipientKind'],
    recipientInstructorId: dto.recipientInstructorId,
    recipientUserId: dto.recipientUserId,
    dispatchPolicy: dto.dispatchPolicy as Notification['dispatchPolicy'],
    subject: dto.subject ?? undefined,
    status: dto.status as Notification['status'],
    errorDetail: dto.errorDetail ?? undefined,
    sentAt: dto.sentAt,
    dismissedBy: dto.dismissedBy,
    dismissedAt: dto.dismissedAt,
    createdAt: dto.createdAt,
    issues: dto.issues ?? [],
  }
}

/** Resolves each instructor recipient's id to a display name/email via GET /instructors/{id} (deduped per unique id). */
async function enrichRecipients(list: Notification[]): Promise<Notification[]> {
  const ids = [...new Set(list.filter((n) => n.recipientKind === 'instructor' && n.recipientInstructorId).map((n) => n.recipientInstructorId as string))]
  if (!ids.length) return list

  const instructors = await Promise.all(ids.map((id) => getInstructor(id).catch(() => null)))
  const byId = new Map(ids.map((id, i) => [id, instructors[i]]))

  return list.map((n) => {
    const instructor = n.recipientInstructorId ? byId.get(n.recipientInstructorId) : null
    return instructor ? { ...n, recipientName: instructor.fullName, recipientEmail: instructor.email } : n
  })
}

async function enrichRecipient(n: Notification): Promise<Notification> {
  return (await enrichRecipients([n]))[0] ?? n
}

/** Maps + recipient-enriches a single row off the notifications SSE stream (`useNotificationStream`) — same shape as a `listNotifications`/send/dismiss response row. */
export async function mapStreamNotification(dto: NotificationResponse): Promise<Notification> {
  return enrichRecipient(mapNotification(dto))
}

/**
 * URL for the live notification-status feed — GET /notifications/stream (§Epic C). Unlike the cohort-scoped
 * standup/gate4/sync streams, this one isn't scoped to a cohort or run: it pushes notification.sent /
 * notification.failed / notification.skipped events for every dispatch path (auto-dispatch, manual send/retry,
 * send-all, dismiss), so callers filter to what they care about. Browser `EventSource` can't set an
 * `Authorization` header, so the JWT rides in the query string instead (same convention as the other streams).
 */
export function notificationStreamUrl(): string {
  const token = getToken() ?? ''
  return `${BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`
}

function buildNotificationsQuery(filters: NotificationListFilters): string {
  const params = new URLSearchParams()
  if (filters.cohortId) params.set('cohortId', filters.cohortId)
  if (filters.syncJobId) params.set('syncJobId', filters.syncJobId)
  if (filters.status) params.set('status', filters.status)
  if (filters.type) params.set('type', filters.type)
  if (filters.recipientKind) params.set('recipientKind', filters.recipientKind)
  if (filters.page !== undefined) params.set('page', String(filters.page))
  if (filters.size !== undefined) params.set('size', String(filters.size))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Newest-first staged notifications (Epic C) — GET /notifications, optionally narrowed to a cohort/sync job/status/type/recipient kind. */
export async function listNotifications(filters: NotificationListFilters = {}): Promise<Paged<Notification>> {
  if (USE_MOCKS) {
    const { mockDelay, notifications } = await import('./mock/fixtures')
    const list = notifications
      .filter((n) => !filters.cohortId || n.cohortId === filters.cohortId)
      .filter((n) => !filters.syncJobId || n.ingestionRunId === filters.syncJobId)
      .filter((n) => !filters.status || n.status === filters.status)
      .filter((n) => !filters.type || n.type === filters.type)
      .filter((n) => !filters.recipientKind || n.recipientKind === filters.recipientKind)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    const size = filters.size ?? 20
    const page = filters.page ?? 0
    const start = page * size
    const content = list.slice(start, start + size)
    return mockDelay({
      content,
      number: page,
      size,
      totalElements: list.length,
      totalPages: Math.max(1, Math.ceil(list.length / size)),
      last: start + size >= list.length,
    })
  }
  const page = await http.get<Paged<NotificationResponse>>(`/notifications${buildNotificationsQuery(filters)}`)
  return { ...page, content: await enrichRecipients(page.content.map(mapNotification)) }
}

export async function sendNotification(id: string): Promise<Notification> {
  if (USE_MOCKS) {
    const { mockDelay, notifications } = await import('./mock/fixtures')
    const n = notifications.find((x) => x.id === id)
    if (!n) throw new Error('Notification not found')
    if (n.status === 'PENDING' || n.status === 'FAILED') {
      n.status = 'SENT'
      n.sentAt = new Date().toISOString()
    }
    return mockDelay(n)
  }
  return enrichRecipient(mapNotification(await http.post<NotificationResponse>(`/notifications/${id}/send`)))
}

/**
 * Send-all only queues PENDING/HELD items (AUTO ones dispatch on their own) and returns 202 immediately with
 * just the count queued — the actual sends happen off-thread, one after another, so the outcome isn't known
 * yet when this resolves. Callers should re-poll `listNotifications` (filtered by syncJobId/status) to see it.
 */
export async function sendAllNotifications(runId: string): Promise<number> {
  if (USE_MOCKS) {
    const { mockDelay, notifications } = await import('./mock/fixtures')
    const now = new Date().toISOString()
    const affected = notifications.filter((n) => n.ingestionRunId === runId && n.status === 'PENDING')
    affected.forEach((n) => {
      n.status = 'SENT'
      n.sentAt = now
    })
    return mockDelay(affected.length)
  }
  return http.post<number>(`/notifications/send-all?syncJobId=${encodeURIComponent(runId)}`)
}

export async function dismissNotification(id: string): Promise<Notification> {
  if (USE_MOCKS) {
    const { mockDelay, notifications } = await import('./mock/fixtures')
    const n = notifications.find((x) => x.id === id)
    if (!n) throw new Error('Notification not found')
    if (n.status === 'PENDING') n.status = 'SKIPPED'
    return mockDelay(n)
  }
  return enrichRecipient(mapNotification(await http.post<NotificationResponse>(`/notifications/${id}/dismiss`)))
}
