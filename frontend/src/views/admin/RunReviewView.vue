<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import { useRunReviewStore } from '@/stores/runReview'
import { useToastStore } from '@/stores/toast'
import type { RunStatus } from '@/types/run.types'
import type { Notification, NotificationStatus } from '@/types/runReview.types'

const route = useRoute()
const store = useRunReviewStore()
const toast = useToastStore()

const runId = route.params.id as string

onMounted(() => store.fetchReview(runId))

const review = computed(() => store.review)
const run = computed(() => store.review?.run ?? null)
const conflicts = computed(() => store.review?.conflicts ?? [])
const notifications = computed(() => store.review?.notifications ?? [])
const pendingCount = computed(() => notifications.value.filter((n) => n.status === 'PENDING').length)

const RUN_TONE: Record<RunStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  completed: 'success', partial: 'warning', failed: 'danger', skipped: 'info', processing: 'info',
}

const SUMMARY = [
  { key: 'rowsRead', label: 'Rows read' },
  { key: 'committedNew', label: 'New' },
  { key: 'updated', label: 'Updated' },
  { key: 'skippedInvalid', label: 'Skipped — invalid' },
  { key: 'skippedUnchanged', label: 'Skipped — unchanged' },
  { key: 'conflicts', label: 'Conflicts' },
] as const

const NOTIF_TONE: Record<NotificationStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning', SENT: 'success', SKIPPED: 'info', FAILED: 'danger',
}
const NOTIF_LABEL: Record<NotificationStatus, string> = {
  PENDING: 'Held', SENT: 'Sent', SKIPPED: 'Dismissed', FAILED: 'Failed',
}

function notifTypeLabel(t: Notification['type']): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

async function resolveConflict(id: string, chosenRowIndex: number | null) {
  try {
    await store.resolveConflict(id, { chosenRowIndex })
    toast.show({ tone: 'success', title: chosenRowIndex === null ? 'Conflict rejected' : 'Conflict resolved' })
  } catch {
    toast.show({ tone: 'warning', title: 'Could not resolve conflict' })
  }
}

async function dismissConflict(id: string) {
  try {
    await store.dismissConflict(id)
    toast.show({ tone: 'info', title: 'Conflict dismissed' })
  } catch {
    toast.show({ tone: 'warning', title: 'Could not dismiss conflict' })
  }
}

async function sendOne(n: Notification) {
  try {
    await store.sendNotification(n.id)
    toast.show({ tone: 'success', title: 'Notification sent', body: n.recipientEmail })
  } catch {
    toast.show({ tone: 'warning', title: 'Send failed' })
  }
}

async function dismissNotif(n: Notification) {
  try {
    await store.dismissNotification(n.id)
  } catch {
    toast.show({ tone: 'warning', title: 'Could not dismiss' })
  }
}

async function sendAll() {
  try {
    await store.sendAll(runId)
    toast.show({ tone: 'success', title: 'Held notifications sent' })
  } catch {
    toast.show({ tone: 'warning', title: 'Send-all failed' })
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <RouterLink :to="{ name: 'admin-runs' }" class="back-link"><VIcon name="chevron-left" :size="15" /> Grading runs</RouterLink>
      <h1 class="page-title">
        Run review
        <VPill v-if="run" :tone="RUN_TONE[run.status]">{{ run.status }}</VPill>
      </h1>
      <p class="page-sub mono">{{ run?.workbookFilename ?? '…' }} · {{ run?.cohortName }}</p>
    </div>
  </div>

  <div v-if="store.loading" class="muted">Loading run…</div>

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
            {{ [e.sheet, e.row != null ? `row ${e.row}` : '', e.rule].filter(Boolean).join(' · ') }} — {{ e.message }}
          </li>
        </ul>
      </details>
    </section>

    <!-- Panel 2 — Conflict queue -->
    <section class="block">
      <h2 class="block-title">Conflict queue <span class="count-badge mono">{{ conflicts.length }}</span></h2>
      <p class="block-sub">In-file duplicates — same learner + lab appearing twice. Choose the authoritative row, or reject both.</p>

      <p v-if="conflicts.length === 0" class="empty-note"><VIcon name="check-circle-2" :size="15" class="ic-success" /> No conflicts in this run.</p>

      <div v-for="c in conflicts" :key="c.id" class="conflict-card">
        <div class="conflict-head">
          <span class="mono">{{ c.learnerId }}</span>
          <span class="sep">·</span>
          <span>{{ c.incomingRows[0]?.labTitle }}</span>
          <VPill v-if="c.status !== 'PENDING'" :tone="c.status === 'RESOLVED' ? 'success' : 'info'" style="margin-left: auto">
            {{ c.status === 'RESOLVED' ? 'Resolved' : 'Dismissed' }}
          </VPill>
        </div>

        <div class="merge">
          <div v-if="c.existingResult" class="merge-col existing">
            <span class="merge-tag">Existing (committed)</span>
            <div class="merge-row"><span class="mono score">{{ c.existingResult.score }}</span><span class="muted">{{ c.existingResult.submittedOn }}</span></div>
          </div>
          <div class="merge-col incoming">
            <span class="merge-tag">Incoming ({{ c.incomingRows.length }})</span>
            <div v-for="(row, idx) in c.incomingRows" :key="idx" class="merge-row incoming-row">
              <span class="mono score">{{ row.score }}</span>
              <span class="muted">{{ row.submittedOn }}</span>
              <span class="muted mono src">{{ row.sourceRef }}</span>
              <VButton v-if="c.status === 'PENDING'" size="sm" variant="ghost" @click="resolveConflict(c.id, idx)">Use this</VButton>
            </div>
          </div>
        </div>

        <div v-if="c.status === 'PENDING'" class="conflict-actions">
          <VButton size="sm" variant="ghost" @click="dismissConflict(c.id)">Dismiss</VButton>
          <VButton size="sm" variant="danger" @click="resolveConflict(c.id, null)">Reject both</VButton>
        </div>
        <p v-else-if="c.resolutionNote" class="muted resolution-note">{{ c.resolutionNote }}</p>
      </div>
    </section>

    <!-- Panel 3 — Notification moderation -->
    <section class="block">
      <div class="notif-head">
        <div>
          <h2 class="block-title" style="margin-bottom: 2px">Notifications <span class="count-badge mono">{{ pendingCount }} held</span></h2>
          <p class="block-sub">Instructor digests are held for review. Auto alerts are already sent (shown for transparency).</p>
        </div>
        <VButton variant="primary" icon="send" :disabled="pendingCount === 0" @click="sendAll">Send all held</VButton>
      </div>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr><th>Recipient</th><th>Type</th><th>Policy</th><th style="text-align: center">Status</th><th aria-hidden="true"></th></tr>
          </thead>
          <tbody>
            <tr v-for="n in notifications" :key="n.id">
              <td>
                <div style="font-weight: 500">{{ n.recipientName ?? n.recipientEmail }}</div>
                <div class="muted mono sub">{{ n.recipientEmail }}</div>
              </td>
              <td>{{ notifTypeLabel(n.type) }}</td>
              <td><span class="policy-tag" :class="n.dispatchPolicy === 'HELD' ? 'held' : 'auto'">{{ n.dispatchPolicy }}</span></td>
              <td style="text-align: center"><VPill :tone="NOTIF_TONE[n.status]">{{ NOTIF_LABEL[n.status] }}</VPill></td>
              <td style="text-align: right">
                <div class="notif-actions">
                  <VButton v-if="n.status === 'PENDING'" size="sm" variant="primary" icon="send" @click="sendOne(n)">Notify</VButton>
                  <VButton v-if="n.status === 'FAILED'" size="sm" variant="ghost" icon="rotate-ccw" @click="sendOne(n)">Retry</VButton>
                  <VButton v-if="n.status === 'PENDING'" size="sm" variant="ghost" @click="dismissNotif(n)">Dismiss</VButton>
                  <span v-if="n.status === 'SENT' && n.sentAt" class="muted mono sub">{{ n.sentAt.slice(0, 16).replace('T', ' ') }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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

.err-details { margin-top: 14px; }
.err-details summary { cursor: pointer; font-size: 13px; color: var(--text-secondary); font-weight: 500; }
.err-list { list-style: none; display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.err-item { font-size: 12.5px; color: var(--danger); background: var(--danger-bg); padding: 6px 10px; border-radius: 3px; }

.empty-note { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 14px; }

.conflict-card { border: 1px solid var(--border); border-radius: var(--r-md, 6px); padding: 16px; margin-bottom: 12px; background: var(--surface); box-shadow: var(--shadow-card); }
.conflict-head { display: flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 12px; }
.conflict-head .sep { opacity: 0.4; }
.merge { display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; }
.merge-col { border: 1px solid var(--border); border-radius: var(--r-sm, 4px); padding: 12px; }
.merge-col.existing { background: var(--bg); }
.merge-col.incoming { background: rgba(255, 90, 0, 0.04); }
.merge-tag { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); display: block; margin-bottom: 8px; }
.merge-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
.merge-row .score { font-size: 16px; font-weight: 600; }
.incoming-row { border-top: 1px solid var(--border-soft, var(--border)); }
.incoming-row:first-of-type { border-top: none; }
.src { font-size: 12px; margin-left: auto; }
.conflict-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.resolution-note { margin-top: 10px; font-size: 13px; }

.notif-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.notif-actions { display: inline-flex; align-items: center; gap: 8px; justify-content: flex-end; }
.sub { font-size: 12px; }
.policy-tag { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 3px; }
.policy-tag.held { background: rgba(255, 90, 0, 0.12); color: var(--orange-dark, #a83900); }
.policy-tag.auto { background: var(--bg); color: var(--text-secondary); border: 1px solid var(--border); }
</style>
