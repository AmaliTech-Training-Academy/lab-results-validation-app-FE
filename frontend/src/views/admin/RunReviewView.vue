<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import VIcon from '@/components/base/VIcon.vue'
import VModal from '@/components/base/VModal.vue'
import VPill from '@/components/base/VPill.vue'
import VTablePager from '@/components/base/VTablePager.vue'
import VRowActions from '@/components/base/VRowActions.vue'
import VSummaryStat from '@/components/base/VSummaryStat.vue'
import { useRunReviewStore } from '@/stores/runReview'
import { useRunsStore } from '@/stores/runs'
import { useSyncRunStream } from '@/composables/useSyncRunStream'
import { useNotificationStream } from '@/composables/useNotificationStream'
import { useToastAction } from '@/composables/useToastAction'
import { useToastStore } from '@/stores/toast'
import { toErrorMessage } from '@/utils/errors'
import { fmtDate, fmtTime } from '@/utils/datetime'
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

// Matches the store's own hardcoded CONFLICTS_PAGE_SIZE/NOTIFICATIONS_PAGE_SIZE — neither the
// conflicts nor the notifications endpoint currently take a caller-chosen size.
const PAGE_SIZE = 20

/** Loads the review + its two paged panels together — used once the sync stream completes, and by the "Try again" retry. */
function retryReview() {
  return Promise.all([store.fetchReview(cohortId, runId), store.fetchConflicts(cohortId, runId), store.fetchNotifications(cohortId, runId)])
}

// The run-review REST payload isn't ready while the sync job is still running
// (§9c) — this stream drives the processing panel, then fetches the full
// review once the backend's sync.done event lands.
const stream = useSyncRunStream(cohortId, runId, {
  onDone: retryReview,
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
    await retryReview()
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

// This is a per-run detail page — a static "Run review" title is indistinguishable from any other
// run in the tab bar/history, so keep it reactive to the cohort name as soon as it's known.
watchEffect(() => {
  const cohort = headerRun.value?.cohortName
  document.title = `Run review${cohort ? ` · ${cohort}` : ''} · Validata`
})

// ── Row actions (kebab) — matches the row-actions pattern used across the other admin tables
// (Runs/Cohorts/Sync schedules/Learners/User management): one shared "which row is open" id, the
// positioning/outside-click/Escape handling now lives in VRowActions/VPopover. Conflict rows use
// an inline "Review"/"View" VButton instead of a kebab, so this only ever tracks notification ids.
const activeKebabId = ref<string | null>(null)

function onKebabToggle(payload: { id: string; anchor: HTMLElement }) {
  activeKebabId.value = payload.id
}
function closeKebab() {
  activeKebabId.value = null
}
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
  { key: 'rowsRead', label: 'Rows read', tone: 'info' },
  { key: 'committedNew', label: 'New', tone: 'success' },
  { key: 'updated', label: 'Updated', tone: 'info' },
  { key: 'skippedInvalid', label: 'Skipped — invalid', tone: 'warning' },
  { key: 'skippedUnchanged', label: 'Skipped — unchanged', tone: 'neutral' },
  { key: 'conflicts', label: 'Conflicts', tone: 'success' },
] as const

/** `skippedInvalid`/`conflicts` escalate to a stronger tone once their count is non-zero — everything else keeps its base tone. */
function summaryTone(key: (typeof SUMMARY)[number]['key'], base: (typeof SUMMARY)[number]['tone']): 'info' | 'success' | 'warning' | 'neutral' | 'danger' {
  if (key === 'skippedInvalid' && (run.value?.counts?.skippedInvalid ?? 0) > 0) return 'danger'
  if (key === 'conflicts' && (run.value?.counts?.conflicts ?? 0) > 0) return 'warning'
  return base
}

const FILE_SUMMARY = [
  { key: 'rowsRead', label: 'Rows read' },
  { key: 'committedNew', label: 'New' },
  { key: 'updatedCount', label: 'Updated' },
  { key: 'skippedInvalid', label: 'Invalid' },
  { key: 'skippedUnchanged', label: 'Unchanged' },
  { key: 'conflictsCount', label: 'Conflicts' },
] as const

/** Viewer-local date + time, e.g. "21 Jul 2026 08:05" — replaces the old raw-UTC `iso.slice(0, 16)`. */
function formatRunAt(iso: string | null | undefined): string {
  const time = fmtTime(iso)
  return time ? `${fmtDate(iso)} ${time}` : fmtDate(iso)
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

/** Re-fetches the page currently shown — used by the "new activity" banner once a live event lands off-page. */
function refreshNotifications() {
  store.fetchNotifications(cohortId, runId, store.notificationsPage?.number ?? 0)
}

// ── Conflict resolution drawer — replaces per-button table actions with a single "Review" entry
// point that opens a merge-style comparison (existing vs. every incoming candidate), a pick, an
// optional note, then one explicit confirm. Safer than firing the resolve call straight off a table
// button, and it's the only place `note` (previously dead — no UI ever set it) gets surfaced.
const reviewingConflict = ref<IngestionConflictResponse | null>(null)
/** 'existing' keeps the committed row; a number is the chosen `ConflictCandidate.index`. */
const selectedChoice = ref<'existing' | number | null>(null)
const resolutionNote = ref('')
const resolveBusy = ref(false)
const resolveError = ref<string | null>(null)

const RESOLVE_TOAST_TITLE: Record<ConflictResolutionAction, string> = {
  KEEP_EXISTING: 'Kept the existing row',
  KEEP_INCOMING: 'Kept the incoming row',
  REJECT: 'Conflict rejected',
}

function openReview(c: IngestionConflictResponse) {
  closeKebab()
  reviewingConflict.value = c
  selectedChoice.value = null
  resolutionNote.value = ''
  resolveError.value = null
}
function closeReview() {
  reviewingConflict.value = null
}
function selectChoice(choice: 'existing' | number) {
  if (reviewingConflict.value?.status !== 'PENDING') return
  selectedChoice.value = choice
}
function candidateLocation(cand: IngestionConflictResponse['candidates'][number]): string {
  return [cand.sheetName ? `sheet ${cand.sheetName}` : '', cand.rowNum != null ? `row ${cand.rowNum}` : ''].filter(Boolean).join(' ') || cand.fileName
}

async function confirmResolve(action: ConflictResolutionAction) {
  const c = reviewingConflict.value
  if (!c) return
  resolveBusy.value = true
  resolveError.value = null
  try {
    await store.resolveConflict(cohortId, c.id, {
      action,
      chosenRowIndex: typeof selectedChoice.value === 'number' ? selectedChoice.value : undefined,
      note: resolutionNote.value.trim() || undefined,
    })
    toast.show({ tone: 'success', title: RESOLVE_TOAST_TITLE[action] })
    closeReview()
  } catch (e) {
    resolveError.value = toErrorMessage(e, 'Could not resolve conflict')
  } finally {
    resolveBusy.value = false
  }
}
function confirmKeep() {
  if (selectedChoice.value == null) return
  confirmResolve(selectedChoice.value === 'existing' ? 'KEEP_EXISTING' : 'KEEP_INCOMING')
}
function confirmReject() {
  confirmResolve('REJECT')
}

// "Reject both" dismisses the conflict outright with no way back — confirm before firing.
const rejectConfirmOpen = ref(false)
async function confirmRejectBoth() {
  rejectConfirmOpen.value = false
  await confirmReject()
}

async function sendOne(n: Notification) {
  closeKebab()
  await withToast(() => store.sendNotification(n.id), {
    success: { tone: 'success', title: 'Send queued', body: recipientLabel(n) },
    error: { tone: 'warning', title: 'Could not queue send' },
  })
}

async function dismissNotif(n: Notification) {
  closeKebab()
  await withToast(() => store.dismissNotification(n.id), {
    error: { tone: 'warning', title: 'Could not dismiss' },
  })
}

// Bulk-sends every held notification for the whole run — confirm before firing.
const sendAllConfirmOpen = ref(false)
async function confirmSendAll() {
  sendAllConfirmOpen.value = false
  await sendAll()
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

  <!-- folderErrors survives past sync.done (only `reset()`/`start()` clear it) — but the panel
       below that renders it while syncing is gone once isPolling flips false, so without this the
       admin briefly sees "folder X couldn't be listed" mid-sync and then it vanishes the moment the
       page moves on to the loading/loaded/error state, with no trace of a real backend-reported
       cause. Kept visible here across every state that follows. -->
  <ul v-if="!stream.isPolling.value && stream.folderErrors.value.length" class="err-list" style="margin: 0 0 16px">
    <li v-for="(e, i) in stream.folderErrors.value" :key="i" class="err-item mono">{{ e.folder }} — {{ e.error }}</li>
  </ul>

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

  <div v-else-if="stream.disconnected.value" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Lost connection to the sync stream</p>
    <p class="load-error-sub">{{ stream.error.value }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="stream.start()">Reconnect</VButton>
  </div>

  <section v-else-if="store.loading" class="block">
    <h2 class="block-title">Results</h2>
    <dl class="summary">
      <div v-for="i in SUMMARY.length" :key="i" class="summary-cell">
        <dt><span class="skel" style="width: 70%" /></dt>
        <dd><span class="skel" style="width: 36px; height: 24px; margin-top: 2px" /></dd>
      </div>
    </dl>
    <div class="tbl-wrap file-breakdown" style="margin-top: 20px">
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
          <tr v-for="i in 3" :key="i" class="skel-row">
            <td><span class="skel" style="width: 65%" /></td>
            <td><span class="skel" style="width: 55%" /></td>
            <td style="text-align: center"><span class="skel" style="width: 44px; display: inline-block" /></td>
            <td v-for="s in FILE_SUMMARY" :key="s.key" style="text-align: center"><span class="skel" style="width: 24px; display: inline-block" /></td>
            <td><span class="skel" style="width: 90px" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <div v-else-if="store.error" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load this run</p>
    <p class="load-error-sub">{{ store.error }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="retryReview">Try again</VButton>
  </div>

  <template v-else-if="review">
    <!-- Panel 1 — Results summary -->
    <section class="block">
      <h2 class="block-title">Results</h2>
      <div v-if="run?.highFailure" class="hi-fail-banner">
        <VIcon name="alert-triangle" :size="16" />
        High failure rate — more than 50% of rows were rejected in this file.
      </div>
      <dl class="summary">
        <VSummaryStat
          v-for="s in SUMMARY"
          :key="s.key"
          :label="s.label"
          :value="run?.counts?.[s.key] ?? 0"
          :tone="summaryTone(s.key, s.tone)"
        />
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
    <section class="block block-card">
      <div class="conflicts-head">
        <h2 class="block-title">
          Conflict queue
          <VIcon name="info" :size="14" class="info-hint" title="In-file duplicates — same learner + lab appearing twice, held for manual resolution." />
        </h2>
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

      <div v-if="store.conflictsLoading" class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Learner</th>
              <th>Lab</th>
              <th>Marks</th>
              <th style="text-align: center">Status</th>
              <th>Created</th>
              <th style="text-align: right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in 3" :key="i" class="skel-row">
              <td><span class="skel" style="width: 70%" /></td>
              <td><span class="skel" style="width: 60%" /></td>
              <td><span class="skel" style="width: 80px" /></td>
              <td style="text-align: center"><span class="skel" style="width: 60px; border-radius: 999px; display: inline-block" /></td>
              <td><span class="skel" style="width: 90px" /></td>
              <td style="text-align: right"><span class="skel" style="width: 70px; display: inline-block" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="store.conflictsError" class="inline-error"><VIcon name="alert-circle" :size="14" /> {{ store.conflictsError }}</p>
      <template v-else>
        <p v-if="conflictRows.length === 0" class="empty-note"><VIcon name="check-circle-2" :size="15" class="ic-success" /> No conflicts in this run.</p>

        <div v-else class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Lab</th>
                <th>Marks</th>
                <th style="text-align: center">Status</th>
                <th>Created</th>
                <th style="text-align: right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in conflictRows" :key="c.id">
                <td>{{ c.learnerName ?? c.learnerId ?? '—' }}</td>
                <td>{{ c.labTitle ?? c.labId ?? '—' }}</td>
                <td>
                  <div class="marks-summary">
                    <span v-if="c.existingResult" class="mark-chip mark-chip--existing" title="Existing (committed)">{{ c.existingResult.score }}</span>
                    <span v-for="cand in c.candidates" :key="cand.index" class="mark-chip" :class="{ 'mark-chip--corrupt': !cand.payloadIntact }" :title="candidateLocation(cand)">
                      {{ cand.score ?? '—' }}
                    </span>
                  </div>
                </td>
                <td style="text-align: center"><VPill :tone="CONFLICT_STATUS_TONE[c.status] ?? 'info'">{{ c.status }}</VPill></td>
                <td class="mono muted">{{ formatRunAt(c.createdAt) }}</td>
                <td style="text-align: right">
                  <VButton size="sm" variant="ghost" icon="git-merge" @click="openReview(c)">{{ c.status === 'PENDING' ? 'Review' : 'View' }}</VButton>
                </td>
              </tr>
            </tbody>
          </table>

          <VTablePager
            v-if="store.conflictsPage && conflictRows.length > 0"
            :total="store.conflictsPage.totalElements"
            :page="store.conflictsPage.number + 1"
            :page-size="PAGE_SIZE"
            @update:page="(p) => changeConflictsPage(p - 1)"
          />
        </div>
      </template>
    </section>

    <!-- Panel 3 — Notification moderation -->
    <section class="block block-card">
      <div class="notif-head">
        <div>
          <h2 class="block-title" style="margin-bottom: 2px">
            Notifications
            <VIcon name="info" :size="14" class="info-hint" title="Instructor digests are held for review. Auto alerts are already sent (shown for transparency)." />
            <span class="count-badge mono">{{ pendingCount }} held on this page</span>
          </h2>
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
          <VButton size="sm" variant="primary" icon="send" :disabled="!canSendAll" @click="sendAllConfirmOpen = true">Send all held</VButton>
        </div>
      </div>

      <div v-if="store.notificationsStale" class="stale-banner">
        <VIcon name="mail" :size="14" />
        New notification activity for this run.
        <button type="button" class="link-btn" @click="refreshNotifications">Refresh<VIcon name="refresh-cw" :size="12" /></button>
      </div>
      <p v-if="notifStream.error.value" class="inline-error">
        <VIcon name="alert-circle" :size="14" /> {{ notifStream.error.value }}
        <button v-if="notifStream.disconnected.value" type="button" class="link-btn" @click="notifStream.start()">Reconnect</button>
      </p>

      <div v-if="store.notificationsLoading" class="tbl-wrap">
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
            <tr v-for="i in 3" :key="i" class="skel-row">
              <td><span class="skel" style="width: 65%" /></td>
              <td><span class="skel" style="width: 55%" /></td>
              <td><span class="skel" style="width: 50px; display: inline-block" /></td>
              <td style="text-align: center"><span class="skel" style="width: 60px; border-radius: 999px; display: inline-block" /></td>
              <td><span class="skel" style="width: 40px" /></td>
              <td><span class="skel" style="width: 90px" /></td>
              <td style="text-align: right"><span class="skel" style="width: 18px; display: inline-block" /></td>
            </tr>
          </tbody>
        </table>
      </div>
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
                    <VRowActions v-if="n.status === 'PENDING' || n.status === 'FAILED'" :active-id="activeKebabId" :row-id="n.id" @toggle="onKebabToggle" @close="closeKebab">
                      <button v-if="n.status === 'PENDING'" class="pop-item" @click="sendOne(n)">
                        <VIcon name="send" :size="15" />
                        Notify
                      </button>
                      <button v-if="n.status === 'FAILED'" class="pop-item" @click="sendOne(n)">
                        <VIcon name="rotate-ccw" :size="15" />
                        Retry
                      </button>
                      <button v-if="n.status === 'PENDING'" class="pop-item" @click="dismissNotif(n)">
                        <VIcon name="x" :size="15" />
                        Dismiss
                      </button>
                    </VRowActions>
                    <span v-else class="muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <VTablePager
            v-if="store.notificationsPage && notifications.length > 0"
            :total="store.notificationsPage.totalElements"
            :page="store.notificationsPage.number + 1"
            :page-size="PAGE_SIZE"
            @update:page="(p) => changeNotificationsPage(p - 1)"
          />
        </div>
      </template>
    </section>
  </template>

  <!-- Conflict resolution drawer — merge-style comparison: pick existing or a candidate, add an
       optional note, then one explicit confirm. Read-only (no picking) once already resolved/dismissed. -->
  <VDrawer
    :open="!!reviewingConflict"
    :title="reviewingConflict ? (reviewingConflict.learnerName ?? reviewingConflict.learnerId ?? 'Conflict') : ''"
    :subtitle="reviewingConflict?.labTitle ?? reviewingConflict?.labId ?? undefined"
    :error="resolveError || undefined"
    @close="closeReview"
  >
    <template v-if="reviewingConflict">
      <p v-if="reviewingConflict.remediation" class="remediation-note">{{ reviewingConflict.remediation }}</p>

      <div class="compare-grid" role="radiogroup" aria-label="Which row to keep">
        <button
          type="button"
          class="compare-card"
          :class="{ 'compare-card--pickable': reviewingConflict.status === 'PENDING' && reviewingConflict.existingResult, 'compare-card--selected': selectedChoice === 'existing' }"
          :disabled="reviewingConflict.status !== 'PENDING' || !reviewingConflict.existingResult"
          role="radio"
          :aria-checked="selectedChoice === 'existing'"
          @click="selectChoice('existing')"
        >
          <VIcon v-if="selectedChoice === 'existing'" name="check-circle-2" :size="16" class="compare-check" />
          <div class="compare-label">Existing (committed)</div>
          <template v-if="reviewingConflict.existingResult">
            <div class="compare-score mono">{{ reviewingConflict.existingResult.score }}</div>
            <div class="compare-meta">{{ reviewingConflict.existingResult.reviewerName ?? '—' }} · {{ reviewingConflict.existingResult.submittedOn }}</div>
          </template>
          <div v-else class="compare-empty">No committed row yet</div>
        </button>
        <button
          v-for="cand in reviewingConflict.candidates"
          :key="cand.index"
          type="button"
          class="compare-card"
          :class="{ 'compare-card--pickable': reviewingConflict.status === 'PENDING' && cand.payloadIntact, 'compare-card--selected': selectedChoice === cand.index }"
          :disabled="reviewingConflict.status !== 'PENDING' || !cand.payloadIntact"
          role="radio"
          :aria-checked="selectedChoice === cand.index"
          @click="selectChoice(cand.index)"
        >
          <VIcon v-if="selectedChoice === cand.index" name="check-circle-2" :size="16" class="compare-check" />
          <div class="compare-label mono">{{ candidateLocation(cand) }}</div>
          <div class="compare-score mono">{{ cand.score ?? '—' }}</div>
          <div class="compare-meta">{{ cand.reviewerName ?? '—' }} · {{ cand.submittedOn ?? '—' }}</div>
          <p v-if="!cand.payloadIntact" class="compare-warn"><VIcon name="alert-triangle" :size="12" /> Incomplete row — can't be kept</p>
        </button>
      </div>

      <template v-if="reviewingConflict.status === 'PENDING'">
        <label class="ff" style="margin-top: 16px">
          <span class="ff-label">Note (optional)</span>
          <span class="ff-input" style="height: auto; padding: 10px 14px">
            <textarea v-model="resolutionNote" rows="2" placeholder="Why this decision — shown in the audit log" style="border: none; outline: none; resize: vertical; width: 100%; font-family: inherit; font-size: 14px; background: transparent" />
          </span>
        </label>
      </template>
      <template v-else>
        <p class="resolution-meta">
          <strong>{{ reviewingConflict.status === 'DISMISSED' ? 'Rejected' : 'Resolved' }}</strong>
          <template v-if="reviewingConflict.resolvedAt"> {{ formatRunAt(reviewingConflict.resolvedAt) }}</template>
          <template v-if="reviewingConflict.resolutionNote"> — {{ reviewingConflict.resolutionNote }}</template>
        </p>
      </template>
    </template>

    <template v-if="reviewingConflict?.status === 'PENDING'" #footer>
      <VButton variant="danger" :disabled="resolveBusy" @click="rejectConfirmOpen = true">Reject both</VButton>
      <VButton variant="primary" :disabled="selectedChoice == null || resolveBusy" @click="confirmKeep">
        {{ resolveBusy ? 'Saving…' : 'Keep selected' }}
      </VButton>
    </template>
    <template v-else #footer>
      <VButton variant="ghost" @click="closeReview">Close</VButton>
    </template>
  </VDrawer>

  <!-- Reject-both confirmation — irreversible, so it gets an explicit step of its own. -->
  <VModal
    :open="rejectConfirmOpen"
    tone="danger"
    title="Reject both rows?"
    :subtitle="reviewingConflict ? (reviewingConflict.learnerName ?? reviewingConflict.learnerId ?? undefined) : undefined"
    @close="rejectConfirmOpen = false"
  >
    <p>This dismisses both the existing and incoming rows for this conflict — neither will be committed, and it can't be undone.</p>
    <template #footer>
      <VButton variant="ghost" :disabled="resolveBusy" @click="rejectConfirmOpen = false">Cancel</VButton>
      <VButton variant="danger" :disabled="resolveBusy" @click="confirmRejectBoth">{{ resolveBusy ? 'Rejecting…' : 'Reject both' }}</VButton>
    </template>
  </VModal>

  <!-- Send-all confirmation — bulk-sends every held notification for this run, not just this page. -->
  <VModal
    :open="sendAllConfirmOpen"
    tone="danger"
    title="Send all held notifications?"
    @close="sendAllConfirmOpen = false"
  >
    <p>
      {{ pendingCount }} notification{{ pendingCount === 1 ? '' : 's' }} held on this page — sending queues every held
      notification for this run, not just this page. This can't be undone.
    </p>
    <template #footer>
      <VButton variant="ghost" @click="sendAllConfirmOpen = false">Cancel</VButton>
      <VButton variant="danger" @click="confirmSendAll">Send all held</VButton>
    </template>
  </VModal>
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
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.file-list { list-style: none; display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
.file-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--r-sm, 4px); background: rgba(0, 0, 0, 0.02); font-size: 13px; color: var(--text-secondary); }
.file-item--failed, .file-item--archive_failed { color: var(--danger); }
.file-item--unchanged, .file-item--archived { color: var(--success); }
.file-name { flex: 1; color: var(--text); }
.file-meta { font-size: 12px; color: var(--text-secondary); }

.block { margin-bottom: 32px; }
.block-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md, 6px); box-shadow: var(--shadow-card); padding: 20px 24px; }
.block-title { font-family: var(--font-display); font-weight: 600; font-size: 16px; color: var(--text); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.block-sub { color: var(--text-secondary); font-size: 13px; margin-bottom: 14px; }
.count-badge { font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 1px 8px; color: var(--text-secondary); font-weight: 400; }

.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.summary-cell { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md, 6px); padding: 16px; box-shadow: var(--shadow-card); }
.summary-cell dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
.summary-cell dd { font-size: 24px; font-weight: 600; color: var(--text); margin-top: 2px; }

.info-hint { color: var(--text-secondary); cursor: help; }

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
.fld select:focus-visible { outline: none; border-color: var(--navy); box-shadow: var(--ring-focus); }
details summary { cursor: pointer; font-size: 12.5px; color: var(--text-secondary); }

/* Conflict queue — collapsed-row "Marks" chips */
.marks-summary { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mark-chip { font-family: var(--font-mono); font-size: 12.5px; font-weight: 600; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-sm, 4px); padding: 2px 8px; }
.mark-chip--existing { background: var(--info-bg); color: var(--info); border-color: transparent; }
.mark-chip--corrupt { color: var(--danger); background: var(--danger-bg); border-color: transparent; text-decoration: line-through; }

/* Conflict resolution drawer — merge-style comparison */
.remediation-note { font-size: 12.5px; color: var(--text-secondary); background: var(--bg); border-radius: var(--r-sm, 4px); padding: 8px 10px; margin: 0 0 14px; }
.compare-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
.compare-card { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md, 6px); padding: 12px; display: flex; flex-direction: column; gap: 4px; text-align: left; font-family: inherit; cursor: default; }
.compare-card--pickable { cursor: pointer; }
.compare-card--pickable:hover { border-color: var(--navy); }
.compare-card--pickable:focus-visible { outline: none; box-shadow: var(--ring-focus); }
.compare-card--selected { border-color: var(--navy); background: var(--info-bg); box-shadow: 0 0 0 1px var(--navy); }
.compare-card:disabled { opacity: 0.6; }
.compare-check { position: absolute; top: 10px; right: 10px; color: var(--navy); }
.compare-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); padding-right: 20px; }
.compare-score { font-size: 22px; font-weight: 600; color: var(--text); }
.compare-meta { font-size: 12px; color: var(--text-secondary); }
.compare-empty { font-size: 12.5px; color: var(--text-secondary); font-style: italic; }
.compare-warn { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--danger); margin: 4px 0 0; }
.resolution-meta { font-size: 13px; color: var(--text-secondary); margin-top: 14px; }

.stale-banner { display: flex; align-items: center; gap: 6px; background: var(--info-bg, rgba(0, 90, 255, 0.06)); color: var(--text); border-radius: var(--r-sm, 4px); padding: 8px 12px; font-size: 13px; margin-bottom: 12px; }
.link-btn { display: inline-flex; align-items: center; gap: 4px; border: none; background: none; padding: 0; margin-left: 4px; color: var(--navy, #08283b); font-weight: 600; font-size: 13px; cursor: pointer; text-decoration: underline; }
.link-btn:hover { color: var(--navy-2, #0f3349); }

.notif-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.notif-head-actions { display: flex; align-items: flex-end; gap: 12px; }

.notif-tbl-scroll { overflow-x: auto; }
.cell-title { font-weight: 500; }
.sub { font-size: 12px; }
.subject { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.danger-note { font-size: 11px; color: var(--danger); margin-top: 4px; max-width: 220px; }
.policy-tag { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 3px; }
.policy-tag.held { background: var(--warning-bg); color: var(--warning); }
.policy-tag.auto { background: var(--bg); color: var(--text-secondary); border: 1px solid var(--border); }
</style>
