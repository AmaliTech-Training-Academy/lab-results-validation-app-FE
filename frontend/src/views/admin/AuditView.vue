<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import { useAuditStore } from '@/stores/audit'
import { useCohortsStore } from '@/stores/cohorts'
import type { RunStatus } from '@/types/run.types'
import type { AuditEvent } from '@/types/audit.types'

const router = useRouter()
const audit = useAuditStore()
const cohorts = useCohortsStore()

const tab = ref<'runs' | 'events'>('runs')
const expandedRun = ref<string | null>(null)

// Filters
const f = ref({ cohortId: '', status: '' as '' | RunStatus, dateFrom: '', dateTo: '', instructorId: '' })

function applyFilters() {
  audit.fetch({
    cohortId: f.value.cohortId || undefined,
    status: f.value.status || undefined,
    dateFrom: f.value.dateFrom || undefined,
    dateTo: f.value.dateTo || undefined,
    instructorId: f.value.instructorId || undefined,
  })
}

function resetFilters() {
  f.value = { cohortId: '', status: '', dateFrom: '', dateTo: '', instructorId: '' }
  applyFilters()
}

onMounted(() => {
  cohorts.fetchList()
  applyFilters()
})

const RUN_TONE: Record<RunStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  completed: 'success', partial: 'warning', failed: 'danger', skipped: 'info', processing: 'info',
}

const EVENT_ICON: Record<string, string> = {
  LINK_SUBMITTED: 'link', GATE_FAILED: 'x-circle', GATE_PASSED: 'check-circle-2',
  REFERENCE_ACCEPTED: 'clipboard-check', DISCARD_RESET: 'rotate-ccw', COHORT_LOCKED: 'lock',
  COHORT_UNLOCKED: 'lock-open', STOOD_UP: 'flag', CONFLICT_RESOLVED: 'git-merge',
}
function eventLabel(t: AuditEvent['eventType']): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function fmt(iso?: string): string {
  return iso ? iso.replace('T', ' ').slice(0, 16) : '—'
}
function payloadPairs(p?: Record<string, unknown>): [string, string][] {
  return p ? Object.entries(p).map(([k, v]) => [k, String(v)]) : []
}
function toggleRun(id: string) {
  expandedRun.value = expandedRun.value === id ? null : id
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1 class="page-title">Audit</h1>
      <p class="page-sub">Every ingestion run and cohort lifecycle event — append-only, cross-run history.</p>
    </div>
  </div>

  <!-- Filter bar -->
  <div class="filter-bar">
    <label class="fld">
      <span>Cohort</span>
      <select v-model="f.cohortId" @change="applyFilters">
        <option value="">All</option>
        <option v-for="c in cohorts.list" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>
    <label class="fld">
      <span>Status</span>
      <select v-model="f.status" @change="applyFilters">
        <option value="">All</option>
        <option value="completed">Completed</option>
        <option value="partial">Partial</option>
        <option value="failed">Failed</option>
        <option value="skipped">Skipped</option>
      </select>
    </label>
    <label class="fld">
      <span>From</span>
      <input v-model="f.dateFrom" type="date" @change="applyFilters" />
    </label>
    <label class="fld">
      <span>To</span>
      <input v-model="f.dateTo" type="date" @change="applyFilters" />
    </label>
    <label class="fld">
      <span>Instructor ID</span>
      <input v-model="f.instructorId" placeholder="INS-001" @change="applyFilters" />
    </label>
    <VButton variant="ghost" size="sm" icon="x" @click="resetFilters">Clear</VButton>
  </div>

  <!-- Tabs -->
  <div class="tabs" role="tablist">
    <button :class="['tab', { on: tab === 'runs' }]" role="tab" :aria-selected="tab === 'runs'" @click="tab = 'runs'">
      Ingestion runs <span class="count-badge mono">{{ audit.runs.length }}</span>
    </button>
    <button :class="['tab', { on: tab === 'events' }]" role="tab" :aria-selected="tab === 'events'" @click="tab = 'events'">
      Lifecycle events <span class="count-badge mono">{{ audit.events.length }}</span>
    </button>
  </div>

  <div v-if="audit.loading" class="muted">Loading audit log…</div>

  <!-- Runs tab -->
  <div v-else-if="tab === 'runs'" class="tbl-wrap">
    <table class="tbl">
      <thead>
        <tr><th>File</th><th>Cohort</th><th>Trigger</th><th style="text-align: center">Status</th><th>When</th><th aria-hidden="true"></th></tr>
      </thead>
      <tbody>
        <template v-for="r in audit.runs" :key="r.id">
          <tr class="row-click" @click="toggleRun(r.id)">
            <td class="mono" style="font-weight: 500">{{ r.workbookFilename ?? '—' }}</td>
            <td>{{ r.cohortName ?? '—' }}</td>
            <td class="muted">{{ !r.triggerType ? '—' : r.triggerType === 'SCHEDULED' ? 'Scheduled · System' : `Manual · ${r.triggeredByEmail ?? r.triggeredBy ?? 'Admin'}` }}</td>
            <td style="text-align: center"><VPill :tone="RUN_TONE[r.status]">{{ r.status }}</VPill></td>
            <td class="mono muted">{{ fmt(r.runAt ?? r.startedAt) }}</td>
            <td style="text-align: right; width: 44px"><VIcon :name="expandedRun === r.id ? 'chevron-down' : 'chevron-right'" :size="18" class="muted" /></td>
          </tr>
          <tr v-if="expandedRun === r.id" class="detail-row">
            <td colspan="6">
              <div class="run-detail">
                <div class="rd-counts mono">
                  {{ r.counts?.rowsRead ?? 0 }} read · {{ r.counts?.committedNew ?? 0 }} new · {{ r.counts?.updated ?? 0 }} updated ·
                  {{ r.counts?.skippedInvalid ?? 0 }} invalid · {{ r.counts?.skippedUnchanged ?? 0 }} unchanged · {{ r.counts?.conflicts ?? 0 }} conflicts
                </div>
                <div v-if="r.sharepointVersionId" class="rd-meta mono muted">version {{ r.sharepointVersionId }} · hash {{ r.quickXorHash }}</div>
                <div v-if="r.errorReport?.length" class="rd-errors">
                  <p class="rd-errors-title">Rejected rows</p>
                  <ul class="err-list">
                    <li v-for="(e, i) in r.errorReport ?? []" :key="i" class="mono err-item">
                      {{ [e.sheet, e.row != null ? `row ${e.row}` : '', e.rule].filter(Boolean).join(' · ') }} — {{ e.message }}
                    </li>
                  </ul>
                </div>
                <VButton size="sm" variant="ghost" icon-right="arrow-right" @click.stop="router.push({ name: 'admin-run-review', params: { id: r.id }, query: { cohortId: r.cohortId } })">Open run review</VButton>
              </div>
            </td>
          </tr>
        </template>
        <tr v-if="audit.runs.length === 0"><td colspan="6"><div class="empty-inline"><VIcon name="scroll-text" :size="24" class="muted" /><p class="empty-sub">No runs match these filters.</p></div></td></tr>
      </tbody>
    </table>
  </div>

  <!-- Events tab -->
  <div v-else class="event-list">
    <div v-for="e in audit.events" :key="e.id" class="event-row">
      <span class="event-ic"><VIcon :name="EVENT_ICON[e.eventType] ?? 'circle'" :size="16" /></span>
      <div class="event-body">
        <div class="event-line">
          <strong>{{ eventLabel(e.eventType) }}</strong>
          <span class="muted">·</span>
          <span class="muted">{{ e.cohortName ?? '—' }}</span>
        </div>
        <div class="event-meta muted mono">
          {{ e.actorEmail ?? 'SYSTEM' }} · {{ fmt(e.occurredAt) }}
          <template v-for="[k, v] in payloadPairs(e.payload)" :key="k"> · {{ k }}={{ v }}</template>
        </div>
      </div>
    </div>
    <div v-if="audit.events.length === 0" class="empty-inline"><VIcon name="scroll-text" :size="24" class="muted" /><p class="empty-sub">No events match these filters.</p></div>
  </div>
</template>

<style scoped>
.page-sub { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }
.muted { color: var(--text-secondary); }

.filter-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-bottom: 20px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md, 6px); }
.fld { display: flex; flex-direction: column; gap: 4px; }
.fld > span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
.fld select, .fld input { height: 38px; border: 1px solid var(--border); border-radius: var(--r-sm, 4px); background: #fff; padding: 0 10px; font-family: inherit; font-size: 14px; color: var(--text); }
.fld input[type="date"] { font-family: var(--font-mono); }
.fld select:focus-visible, .fld input:focus-visible { outline: none; border-color: var(--orange); box-shadow: var(--ring-focus); }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
.tab { background: none; border: none; padding: 10px 16px; font-family: inherit; font-size: 14px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; display: flex; align-items: center; gap: 8px; }
.tab.on { color: var(--navy); border-bottom-color: var(--orange); }
.count-badge { font-size: 11px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; color: var(--text-secondary); }

.row-click { cursor: pointer; }
.detail-row td { background: var(--bg); }
.run-detail { display: flex; flex-direction: column; gap: 10px; padding: 6px 4px; }
.rd-counts { font-size: 13px; }
.rd-meta { font-size: 12px; }
.rd-errors-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
.err-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.err-item { font-size: 12.5px; color: var(--danger); background: var(--danger-bg); padding: 6px 10px; border-radius: 3px; }

.event-list { display: flex; flex-direction: column; }
.event-row { display: flex; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--border-soft, var(--border)); }
.event-ic { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: var(--bg); color: var(--text-secondary); flex-shrink: 0; }
.event-line { display: flex; align-items: center; gap: 6px; }
.event-meta { font-size: 12.5px; margin-top: 2px; }

.empty-inline { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 16px; text-align: center; }
.empty-sub { color: var(--text-secondary); font-size: 14px; }
</style>
