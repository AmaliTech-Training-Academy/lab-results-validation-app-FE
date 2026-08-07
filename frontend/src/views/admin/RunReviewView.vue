<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import { useRunReviewStore } from '@/stores/runReview'
import { useRunsStore } from '@/stores/runs'
import { useSyncRunStream } from '@/composables/useSyncRunStream'
import { useNotificationStream } from '@/composables/useNotificationStream'
import { useToastAction } from '@/composables/useToastAction'
import { useToastStore } from '@/stores/toast'
import { toErrorMessage } from '@/utils/errors'
import type { Paged } from '@/types/common.types'
import { RUN_STATUS_TONE, type SyncFileStatus } from '@/types/run.types'
import {
  CONFLICT_STATUS_TONE,
  type ConflictResolutionAction,
  type ConflictStatus,
  type IngestionConflictResponse,
  type Notification,
  type NotificationStatus,
} from '@/types/runReview.types'

const route = useRoute()
const store = useRunReviewStore()
const runsStore = useRunsStore()
const { run: withToast } = useToastAction()
const toast = useToastStore()

const runId = route.params.id as string
const cohortId = route.query.cohortId as string

// The run-review REST payload isn't ready while the sync job is still running
// (§9c) — this stream drives the processing panel, then fetches the full
// review once the backend's sync.done event lands.
const stream = useSyncRunStream(cohortId, runId, {
  onDone: () =>
    Promise.all([store.fetchReview(cohortId, runId), store.fetchConflicts(cohortId, runId), store.fetchNotifications(cohortId, runId)]),
})

// Notification sends are async (auto-dispatch, or the tail of a manual send/retry/send-all) — this stream
// pushes each outcome live instead of leaving the admin to guess and manually refresh. It's scoped to every
// run/cohort on the backend, so `applyNotificationEvent` filters to this run before touching store state.
const notifStream = useNotificationStream({
  onEvent: (n) => {
    store.applyNotificationEvent(runId, n)
    if (n.status === 'FAILED' && (n.syncJobId === runId || n.ingestionRunId === runId)) {
      toast.show({ tone: 'warning', title: 'Notification failed', body: `${recipientLabel(n)} — ${n.errorDetail ?? 'Delivery failed'}` })
    }
  },
})

const FILE_ICON: Record<SyncFileStatus, string> = {
  discovered: 'loader',
  unchanged: 'check-circle-2',
  changed: 'loader',
  archived: 'check-circle-2',
  failed: 'x-circle',
  archive_failed: 'x-circle',
}
const FILE_META: Record<SyncFileStatus, string> = {
  discovered: 'Scanning…',
  unchanged: 'Unchanged',
  changed: 'Archiving…',
  archived: 'Archived',
  failed: 'Failed',
  archive_failed: 'Archive failed',
}

onMounted(async () => {
  await runsStore.fetchRun(cohortId, runId)
  if (runsStore.current?.status === 'processing') {
    stream.start()
  } else {
    await Promise.all([store.fetchReview(cohortId, runId), store.fetchConflicts(cohortId, runId), store.fetchNotifications(cohortId, runId)])
  }
  notifStream.start()
})

const review = computed(() => store.review)
const run = computed(() => store.review?.run ?? null)
const files = computed(() => store.review?.files ?? [])
/** Falls back to the lightweight run stub while the full review hasn't loaded yet. */
const headerRun = computed(() => review.value?.run ?? runsStore.current)
const conflictRows = computed(() => store.conflictsPage?.content ?? [])
const notifications = computed(() => store.notificationsPage?.content ?? [])
/** Scoped to the current page — informational only. "Send all held" itself touches every PENDING
 * notification for the whole job, page (and filter) or not, so it must not be gated on this. */
const pendingCount = computed(() => notifications.value.filter((n) => n.status === 'PENDING').length)
/**
 * Whether "Send all held" could plausibly have something to do. `totalElements` covers every page for the
 * *current* filter — an exact PENDING total when the filter is 'PENDING', and (when there's no filter at all)
 * an exact total-notifications count, so 0 there really does mean nothing to send. Under any other filter
 * (e.g. viewing only SENT/FAILED) it tells us nothing about how many PENDING notifications exist elsewhere,
 * so we fail open rather than risk a false negative silently blocking a legitimate bulk action — the send-all
 * endpoint is a harmless no-op if nothing is actually queued.
 */
const canSendAll = computed(() => {
  const filter = store.notificationsStatusFilter
  if (filter !== '' && filter !== 'PENDING') return true
  return (store.notificationsPage?.totalElements ?? 0) > 0
})

const SUMMARY = [
  { key: 'rowsRead', label: 'Rows read' },
  { key: 'committedNew', label: 'New' },
  { key: 'updated', label: 'Updated' },
  { key: 'skippedInvalid', label: 'Skipped — invalid' },
  { key: 'skippedUnchanged', label: 'Skipped — unchanged' },
  { key: 'conflicts', label: 'Conflicts' },
] as const

const FILE_SUMMARY = [
  { key: 'rowsRead', label: 'Rows read' },
  { key: 'committedNew', label: 'New' },
  { key: 'updatedCount', label: 'Updated' },
  { key: 'skippedInvalid', label: 'Invalid' },
  { key: 'skippedUnchanged', label: 'Unchanged' },
  { key: 'conflictsCount', label: 'Conflicts' },
] as const

function formatRunAt(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ')
}

const NOTIF_TONE: Record<NotificationStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning', SENT: 'success', SKIPPED: 'info', FAILED: 'danger',
}
const NOTIF_LABEL: Record<NotificationStatus, string> = {
  PENDING: 'Held', SENT: 'Sent', SKIPPED: 'Dismissed', FAILED: 'Failed',
}
/** `mapNotification` casts the real API's `status`/`recipientKind` strings without runtime validation — an
 * unrecognized value (a status the backend adds before the FE knows about it) would otherwise render as a
 * blank pill instead of just falling back to the raw value. */
function notifTone(status: NotificationStatus): 'success' | 'warning' | 'danger' | 'info' {
  return NOTIF_TONE[status] ?? 'info'
}
function notifLabel(status: NotificationStatus): string {
  return NOTIF_LABEL[status] ?? status
}

function notifTypeLabel(t: Notification['type']): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function onConflictStatusChange(status: ConflictStatus | '') {
  store.setConflictsStatusFilter(cohortId, runId, status)
}

function changeConflictsPage(page: number) {
  store.fetchConflicts(cohortId, runId, page)
}

function onNotificationStatusChange(status: NotificationStatus | '') {
  store.setNotificationsStatusFilter(cohortId, runId, status)
}

function changeNotificationsPage(page: number) {
  store.fetchNotifications(cohortId, runId, page)
}

// ── Pagination (server-paged — mirrors the numbered pager used by the
// client-paged admin tables, e.g. RunsView/CohortsView) ─────────────────────
function pageItemsFor(page: Paged<unknown> | null): (number | '…')[] {
  const tp = Math.max(page?.totalPages ?? 1, 1)
  const cur = (page?.number ?? 0) + 1
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const items: (number | '…')[] = []
  if (cur <= 4) {
    for (let i = 1; i <= 5; i++) items.push(i)
    items.push('…', tp)
  } else if (cur >= tp - 3) {
    items.push(1, '…')
    for (let i = tp - 4; i <= tp; i++) items.push(i)
  } else {
    items.push(1, '…', cur - 1, cur, cur + 1, '…', tp)
  }
  return items
}
function showingRange(page: Paged<unknown> | null): { from: number; to: number; total: number } {
  if (!page || page.totalElements === 0) return { from: 0, to: 0, total: 0 }
  const from = page.number * page.size + 1
  return { from, to: from + page.content.length - 1, total: page.totalElements }
}
const conflictsPageItems = computed(() => pageItemsFor(store.conflictsPage))
const conflictsShowing = computed(() => showingRange(store.conflictsPage))
const notificationsPageItems = computed(() => pageItemsFor(store.notificationsPage))
const notificationsShowing = computed(() => showingRange(store.notificationsPage))

/** Re-fetches the page currently shown — used by the "new activity" banner once a live event lands off-page. */
function refreshNotifications() {
  store.fetchNotifications(cohortId, runId, store.notificationsPage?.number ?? 0)
}

const RESOLVE_TOAST_TITLE: Record<ConflictResolutionAction, string> = {
  KEEP_EXISTING: 'Kept the existing row',
  KEEP_INCOMING: 'Kept the incoming row',
  REJECT: 'Conflict rejected',
}

async function resolveConflictRow(c: IngestionConflictResponse, action: ConflictResolutionAction) {
  await withToast(() => store.resolveConflict(cohortId, c.id, { action }), {
    success: { tone: 'success', title: RESOLVE_TOAST_TITLE[action] },
    error: { tone: 'warning', title: 'Could not resolve conflict' },
  })
}

async function sendOne(n: Notification) {
  await withToast(() => store.sendNotification(n.id), {
    success: { tone: 'success', title: 'Send queued', body: recipientLabel(n) },
    error: { tone: 'warning', title: 'Could not queue send' },
  })
}

async function dismissNotif(n: Notification) {
  await withToast(() => store.dismissNotification(n.id), {
    error: { tone: 'warning', title: 'Could not dismiss' },
  })
}

/** Send-all just queues the work (202) and the actual sends happen off-thread — so the toast reports "queued", not "sent", and the caller has to re-check for the outcome. */
async function sendAll() {
  try {
    const queued = await store.sendAll(cohortId, runId)
    toast.show({
      tone: 'success',
      title: 'Held notifications queued',
      body: `${queued} notification${queued === 1 ? '' : 's'} queued — refresh shortly to see delivery status.`,
    })
  } catch (e) {
    toast.show({ tone: 'warning', title: 'Send-all failed', body: toErrorMessage(e, 'Please try again.') })
  }
}

/** Falls back to the raw id when the instructor lookup failed or the recipient is an admin user id. */
function recipientLabel(n: Notification): string {
  return n.recipientName ?? n.recipientEmail ?? n.recipientInstructorId ?? n.recipientUserId ?? '—'
}
</script>

<template>
  <div class="page-head">
    <div>
      <RouterLink :to="{ name: 'admin-runs' }" class="back-link"><VIcon name="chevron-left" :size="15" /> Grading runs</RouterLink>
      <h1 class="page-title">
        Run review
        <VPill v-if="headerRun" :tone="RUN_STATUS_TONE[headerRun.status]">{{ headerRun.status }}</VPill>
      </h1>
      <p class="page-sub mono">{{ headerRun?.cohortName }}</p>
    </div>
  </div>

  <div v-if="stream.isPolling.value" class="panel panel--info">
    <div class="panel-head">
      <VIcon name="loader" :size="18" class="spin" />
      <strong>Syncing grading data…</strong>
    </div>
    <ul class="file-list">
      <li v-for="f in stream.files.value" :key="f.file" :class="['file-item', `file-item--${f.status}`]">
        <VIcon :name="FILE_ICON[f.status]" :size="16" :class="{ spin: f.status === 'discovered' || f.status === 'changed' }" />
        <span class="file-name mono">{{ f.file }}</span>
        <span class="file-meta">{{ f.error ?? FILE_META[f.status] }}</span>
      </li>
      <li v-if="stream.files.value.length === 0" class="file-item">
        <VIcon name="loader" :size="16" class="spin" />
        <span class="file-meta">Scanning SharePoint folder…</span>
      </li>
    </ul>
    <ul v-if="stream.folderErrors.value.length" class="err-list">
      <li v-for="(e, i) in stream.folderErrors.value" :key="i" class="err-item mono">{{ e.folder }} — {{ e.error }}</li>
    </ul>
    <p v-if="stream.error.value" class="inline-error"><VIcon name="alert-circle" :size="14" /> {{ stream.error.value }}</p>
  </div>

  <div v-else-if="store.loading" class="muted">Loading run…</div>

  <p v-else-if="store.error" class="inline-error"><VIcon name="alert-circle" :size="14" /> {{ store.error }}</p>

  <template v-else-if="review">
    <!-- Panel 1 — Results summary -->
    <section class="block">
      <h2 class="block-title">Results</h2>
      <div v-if="run?.highFailure" class="hi-fail-banner">
        <VIcon name="alert-triangle" :size="16" />
        High failure rate — more than 50% of rows were rejected in this file.
      </div>
      <dl class="summary">
        <div v-for="s in SUMMARY" :key="s.key" class="summary-cell" :class="{ bad: s.key === 'skippedInvalid' && (run?.counts?.skippedInvalid ?? 0) > 0, warn: s.key === 'conflicts' && (run?.counts?.conflicts ?? 0) > 0 }">
          <dt>{{ s.label }}</dt>
          <dd class="mono">{{ run?.counts?.[s.key] ?? 0 }}</dd>
        </div>
      </dl>
      <details v-if="run?.errorReport?.length" class="err-details">
        <summary>{{ run.errorReport.length }} rejected row{{ run.errorReport.length === 1 ? '' : 's' }}</summary>
        <ul class="err-list">
          <li v-for="(e, i) in run.errorReport ?? []" :key="i" class="mono err-item">
            {{ [e.location ?? [e.sheet, e.row != null ? `row ${e.row}` : ''].filter(Boolean).join(' '), e.rule].filter(Boolean).join(' · ') }} — {{ e.message }}
          </li>
        </ul>
      </details>

      <h3 v-if="files.length" class="subsection-title">Per-workbook breakdown</h3>
      <div v-if="files.length" class="tbl-wrap file-breakdown">
        <table class="tbl">
          <thead>
            <tr>
              <th>Workbook</th>
              <th>Status</th>
              <th style="text-align: center">Failure rate</th>
              <th v-for="s in FILE_SUMMARY" :key="s.key" style="text-align: center">{{ s.label }}</th>
              <th>Run at</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in files" :key="f.workbookFilename">
              <td class="mono" style="font-weight: 500">{{ f.workbookFilename }}</td>
              <td class="muted">{{ f.status }}</td>
              <td style="text-align: center">
                <VPill :tone="f.highFailureRate ? 'danger' : 'info'">{{ f.failureRatePercent.toFixed(1) }}%</VPill>
              </td>
              <td v-for="s in FILE_SUMMARY" :key="s.key" class="mono" style="text-align: center">{{ f[s.key] }}</td>
              <td class="mono muted">{{ formatRunAt(f.runAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <details v-for="f in files.filter((f) => f.issues.length)" :key="f.workbookFilename + '-issues'" class="err-details">
        <summary>
          <VIcon :name="f.highFailureRate ? 'alert-triangle' : 'alert-circle'" :size="14" />
          {{ f.workbookFilename }} — {{ f.issues.length }} issue{{ f.issues.length === 1 ? '' : 's' }}
          <template v-if="f.highFailureRate">({{ f.failureRatePercent.toFixed(1) }}% rejected)</template>
        </summary>
        <ul class="err-list rejection-summary">
          <li v-for="r in f.rejectionReasons" :key="r.rule" class="mono err-item">{{ r.rule }} — {{ r.count }} row{{ r.count === 1 ? '' : 's' }}</li>
        </ul>
        <ul class="err-list">
          <li v-for="(e, i) in f.issues" :key="i" class="mono err-item">
            {{ [e.location ?? [e.sheet, e.row != null ? `row ${e.row}` : ''].filter(Boolean).join(' '), e.rule].filter(Boolean).join(' · ') }} — {{ e.message }}
          </li>
        </ul>
      </details>
    </section>

    <!-- Panel 2 — Conflict queue -->
    <section class="block">
      <div class="conflicts-head">
        <h2 class="block-title">Conflict queue <span class="count-badge mono">{{ store.conflictsPage?.totalElements ?? 0 }}</span></h2>
        <label class="fld">
          <span>Status</span>
          <select :value="store.conflictsStatusFilter" @change="onConflictStatusChange(($event.target as HTMLSelectElement).value as ConflictStatus | '')">
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </label>
      </div>
      <p class="block-sub">In-file duplicates — same learner + lab appearing twice, held for manual resolution.</p>

      <div v-if="store.conflictsLoading" class="muted">Loading conflicts…</div>
      <p v-else-if="store.conflictsError" class="inline-error"><VIcon name="alert-circle" :size="14" /> {{ store.conflictsError }}</p>
      <template v-else>
        <p v-if="conflictRows.length === 0" class="empty-note"><VIcon name="check-circle-2" :size="15" class="ic-success" /> No conflicts in this run.</p>

        <div v-else class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Lab</th>
                <th>Existing result</th>
                <th style="text-align: center">Status</th>
                <th>Incoming payload</th>
                <th>Resolution</th>
                <th>Created</th>
                <th aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in conflictRows" :key="c.id">
                <td class="mono">{{ c.learnerId ?? '—' }}</td>
                <td class="mono">{{ c.labId ?? '—' }}</td>
                <td class="mono muted">{{ c.existingResultId ?? '— (new row)' }}</td>
                <td style="text-align: center"><VPill :tone="CONFLICT_STATUS_TONE[c.status] ?? 'info'">{{ c.status }}</VPill></td>
                <td>
                  <details>
                    <summary class="mono">payload</summary>
                    <pre class="mono payload">{{ JSON.stringify(c.incomingPayload, null, 2) }}</pre>
                  </details>
                </td>
                <td class="muted">{{ c.resolutionNote ?? '—' }}</td>
                <td class="mono muted">{{ formatRunAt(c.createdAt) }}</td>
                <td style="text-align: right">
                  <div v-if="c.status === 'PENDING'" class="notif-actions">
                    <VButton v-if="c.existingResultId" size="sm" variant="ghost" @click="resolveConflictRow(c, 'KEEP_EXISTING')">Keep existing</VButton>
                    <VButton size="sm" variant="ghost" @click="resolveConflictRow(c, 'KEEP_INCOMING')">Keep incoming</VButton>
                    <VButton size="sm" variant="danger" @click="resolveConflictRow(c, 'REJECT')">Reject</VButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="store.conflictsPage && conflictRows.length > 0" class="pager">
            <span class="pager-count">
              Showing <span class="pg-strong">{{ conflictsShowing.from }}</span> to <span class="pg-strong">{{ conflictsShowing.to }}</span>
              of <span class="pg-strong">{{ conflictsShowing.total }}</span> entries
            </span>
            <div class="pager-ctrls">
              <button class="pg-arrow" aria-label="Previous page" :disabled="store.conflictsPage.number === 0" @click="changeConflictsPage(store.conflictsPage.number - 1)">
                <VIcon name="chevron-left" :size="16" />
              </button>
              <template v-for="(p, i) in conflictsPageItems" :key="i">
                <span v-if="p === '…'" class="pg-ellipsis">…</span>
                <button v-else :class="['pg-num', { on: store.conflictsPage.number + 1 === p }]" @click="changeConflictsPage(Number(p) - 1)">{{ p }}</button>
              </template>
              <button class="pg-arrow" aria-label="Next page" :disabled="store.conflictsPage.last" @click="changeConflictsPage(store.conflictsPage.number + 1)">
                <VIcon name="chevron-right" :size="16" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </section>

    <!-- Panel 3 — Notification moderation -->
    <section class="block">
      <div class="notif-head">
        <div>
          <h2 class="block-title" style="margin-bottom: 2px">Notifications <span class="count-badge mono">{{ pendingCount }} held on this page</span></h2>
          <p class="block-sub">Instructor digests are held for review. Auto alerts are already sent (shown for transparency).</p>
        </div>
        <div class="notif-head-actions">
          <label class="fld">
            <span>Status</span>
            <select :value="store.notificationsStatusFilter" @change="onNotificationStatusChange(($event.target as HTMLSelectElement).value as NotificationStatus | '')">
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>
          <VButton variant="primary" icon="send" :disabled="!canSendAll" @click="sendAll">Send all held</VButton>
        </div>
      </div>

      <div v-if="store.notificationsStale" class="stale-banner">
        <VIcon name="mail" :size="14" />
        New notification activity for this run.
        <button type="button" class="link-btn" @click="refreshNotifications">Refresh<VIcon name="refresh-cw" :size="12" /></button>
      </div>
      <p v-if="notifStream.error.value" class="inline-error"><VIcon name="alert-circle" :size="14" /> {{ notifStream.error.value }}</p>

      <div v-if="store.notificationsLoading" class="muted">Loading notifications…</div>
      <p v-else-if="store.notificationsError" class="inline-error"><VIcon name="alert-circle" :size="14" /> {{ store.notificationsError }}</p>
      <template v-else>
        <p v-if="notifications.length === 0" class="empty-note"><VIcon name="check-circle-2" :size="15" class="ic-success" /> No notifications for this run.</p>

        <div v-else class="tbl-wrap">
          <div class="notif-tbl-scroll">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Type</th>
                  <th>Policy</th>
                  <th style="text-align: center">Status</th>
                  <th>Issues</th>
                  <th>Created</th>
                  <th style="text-align: right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="n in notifications" :key="n.id">
                  <td>
                    <div class="cell-title">{{ recipientLabel(n) }}</div>
                    <div class="muted mono sub">{{ n.recipientKind }}</div>
                  </td>
                  <td>
                    <div class="cell-title">{{ notifTypeLabel(n.type) }}</div>
                    <div v-if="n.subject" class="muted sub subject" :title="n.subject">{{ n.subject }}</div>
                  </td>
                  <td><span class="policy-tag" :class="n.dispatchPolicy === 'HELD' ? 'held' : 'auto'">{{ n.dispatchPolicy }}</span></td>
                  <td style="text-align: center">
                    <VPill :tone="notifTone(n.status)">{{ notifLabel(n.status) }}</VPill>
                    <div v-if="n.status === 'SENT' && n.sentAt" class="muted mono sub">Sent {{ formatRunAt(n.sentAt) }}</div>
                    <div v-if="n.status === 'FAILED' && n.errorDetail" class="danger-note mono" :title="n.errorDetail">{{ n.errorDetail }}</div>
                  </td>
                  <td>
                    <details v-if="n.issues.length">
                      <summary class="mono">{{ n.issues.length }} issue{{ n.issues.length === 1 ? '' : 's' }}</summary>
                      <ul class="err-list">
                        <li v-for="(e, i) in n.issues" :key="i" class="mono err-item">
                          {{ [e.location ?? [e.sheet, e.row != null ? `row ${e.row}` : ''].filter(Boolean).join(' '), e.rule].filter(Boolean).join(' · ') }} — {{ e.message }}
                        </li>
                      </ul>
                    </details>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="mono muted">{{ n.createdAt ? formatRunAt(n.createdAt) : '—' }}</td>
                  <td style="text-align: right">
                    <div v-if="n.status === 'PENDING' || n.status === 'FAILED'" class="notif-actions">
                      <VButton v-if="n.status === 'PENDING'" size="sm" variant="primary" icon="send" @click="sendOne(n)">Notify</VButton>
                      <VButton v-if="n.status === 'FAILED'" size="sm" variant="ghost" icon="rotate-ccw" @click="sendOne(n)">Retry</VButton>
                      <VButton v-if="n.status === 'PENDING'" size="sm" variant="ghost" @click="dismissNotif(n)">Dismiss</VButton>
                    </div>
                    <span v-else class="muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="store.notificationsPage && notifications.length > 0" class="pager">
            <span class="pager-count">
              Showing <span class="pg-strong">{{ notificationsShowing.from }}</span> to <span class="pg-strong">{{ notificationsShowing.to }}</span>
              of <span class="pg-strong">{{ notificationsShowing.total }}</span> entries
            </span>
            <div class="pager-ctrls">
              <button class="pg-arrow" aria-label="Previous page" :disabled="store.notificationsPage.number === 0" @click="changeNotificationsPage(store.notificationsPage.number - 1)">
                <VIcon name="chevron-left" :size="16" />
              </button>
              <template v-for="(p, i) in notificationsPageItems" :key="i">
                <span v-if="p === '…'" class="pg-ellipsis">…</span>
                <button v-else :class="['pg-num', { on: store.notificationsPage.number + 1 === p }]" @click="changeNotificationsPage(Number(p) - 1)">{{ p }}</button>
              </template>
              <button class="pg-arrow" aria-label="Next page" :disabled="store.notificationsPage.last" @click="changeNotificationsPage(store.notificationsPage.number + 1)">
                <VIcon name="chevron-right" :size="16" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </section>
  </template>
</template>

<style scoped>
.page-title { display: flex; align-items: center; gap: 12px; }
.page-sub { color: var(--text-secondary); font-size: 13px; margin-top: 4px; }
.back-link { display: inline-flex; align-items: center; gap: 2px; color: var(--text-secondary); font-size: 13px; font-weight: 500; margin-bottom: 8px; }
.back-link:hover { color: var(--navy); }
.muted { color: var(--text-secondary); }
.ic-success { color: var(--success); }

.panel { margin-bottom: 32px; border: 1px solid var(--border); border-radius: var(--r-sm, 4px); padding: 16px; }
.panel--info { border-left: 4px solid var(--success); }
.panel-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.inline-error { display: flex; align-items: center; gap: 6px; color: var(--danger); font-size: 13px; margin-top: 8px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.file-list { list-style: none; display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
.file-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--r-sm, 4px); background: rgba(0, 0, 0, 0.02); font-size: 13px; color: var(--text-secondary); }
.file-item--failed, .file-item--archive_failed { color: var(--danger); }
.file-item--unchanged, .file-item--archived { color: var(--success); }
.file-name { flex: 1; color: var(--text); }
.file-meta { font-size: 12px; color: var(--text-secondary); }

.block { margin-bottom: 32px; }
.block-title { font-family: var(--font-display); font-weight: 600; font-size: 16px; color: var(--text); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.block-sub { color: var(--text-secondary); font-size: 13px; margin-bottom: 14px; }
.count-badge { font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 1px 8px; color: var(--text-secondary); font-weight: 400; }

.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
.summary-cell { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md, 6px); padding: 14px 16px; box-shadow: var(--shadow-card); }
.summary-cell.bad dd { color: var(--danger); }
.summary-cell.warn dd { color: var(--warning, #b45309); }
.summary-cell dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
.summary-cell dd { font-size: 24px; font-weight: 600; color: var(--text); margin-top: 2px; }

.hi-fail-banner { display: flex; align-items: center; gap: 8px; background: var(--danger-bg); color: var(--danger); border-radius: var(--r-sm, 4px); padding: 10px 14px; font-size: 14px; margin-bottom: 14px; }

.subsection-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin: 20px 0 10px; }
.file-breakdown { margin-top: 4px; }
.err-details { margin-top: 14px; }
.err-details summary { cursor: pointer; font-size: 13px; color: var(--text-secondary); font-weight: 500; }
.err-list { list-style: none; display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.err-list.rejection-summary { margin-bottom: 4px; }
.err-item { font-size: 12.5px; color: var(--danger); background: var(--danger-bg); padding: 6px 10px; border-radius: 3px; }

.empty-note { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 14px; }

.conflicts-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.fld { display: flex; flex-direction: column; gap: 4px; }
.fld > span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
.fld select { height: 34px; border: 1px solid var(--border); border-radius: var(--r-sm, 4px); background: #fff; padding: 0 10px; font-family: inherit; font-size: 13px; color: var(--text); }
.fld select:focus-visible { outline: none; border-color: var(--orange); box-shadow: var(--ring-focus); }
.payload { margin-top: 8px; font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 3px; padding: 8px 10px; max-width: 360px; overflow-x: auto; }
details summary { cursor: pointer; font-size: 12.5px; color: var(--text-secondary); }

.stale-banner { display: flex; align-items: center; gap: 6px; background: var(--info-bg, rgba(0, 90, 255, 0.06)); color: var(--text); border-radius: var(--r-sm, 4px); padding: 8px 12px; font-size: 13px; margin-bottom: 12px; }
.link-btn { display: inline-flex; align-items: center; gap: 4px; border: none; background: none; padding: 0; margin-left: 4px; color: var(--orange, #ff5a00); font-weight: 600; font-size: 13px; cursor: pointer; text-decoration: underline; }
.link-btn:hover { color: var(--orange-dark, #a83900); }

.notif-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.notif-head-actions { display: flex; align-items: flex-end; gap: 12px; }
.notif-actions { display: inline-flex; align-items: center; gap: 8px; justify-content: flex-end; }
.notif-tbl-scroll { overflow-x: auto; }
.cell-title { font-weight: 500; }
.sub { font-size: 12px; }
.subject { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.danger-note { font-size: 11px; color: var(--danger); margin-top: 4px; max-width: 220px; }
.policy-tag { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 3px; }
.policy-tag.held { background: rgba(255, 90, 0, 0.12); color: var(--orange-dark, #a83900); }
.policy-tag.auto { background: var(--bg); color: var(--text-secondary); border: 1px solid var(--border); }
</style>
