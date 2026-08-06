<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VSortIcon from '@/components/base/VSortIcon.vue'
import VPill from '@/components/base/VPill.vue'
import { useAuditStore } from '@/stores/audit'
import { useCohortsStore } from '@/stores/cohorts'
import { useToastStore } from '@/stores/toast'
import { getInstructors } from '@/services/user.service'
import type { IngestionRun, RunStatus } from '@/types/run.types'
import type { AuditEvent } from '@/types/audit.types'

const router = useRouter()
const audit = useAuditStore()
const cohorts = useCohortsStore()
const toast = useToastStore()

const tab = ref<'runs' | 'events'>('runs')
const expandedRun = ref<string | null>(null)

// Filters
const f = ref({ cohortId: '', status: '' as '' | RunStatus, dateFrom: '', dateTo: '', instructorId: '' })
const search = ref('')
const showDateMenu = ref(false)
const instructorOptions = ref<{ id: string; label: string }[]>([])

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
  search.value = ''
  showDateMenu.value = false
  applyFilters()
}

const dateRangeLabel = computed(() => {
  const { dateFrom, dateTo } = f.value
  if (dateFrom && dateTo) return `${dateFrom} → ${dateTo}`
  if (dateFrom) return `From ${dateFrom}`
  if (dateTo) return `Until ${dateTo}`
  return ''
})
function toggleDateMenu(event: MouseEvent) {
  event.stopPropagation()
  showColMenu.value = false
  showDateMenu.value = !showDateMenu.value
}
function clearDates() {
  f.value.dateFrom = ''
  f.value.dateTo = ''
  applyFilters()
}

onMounted(() => {
  cohorts.fetchList()
  applyFilters()
  getInstructors(0, 1000)
    .then((res) => {
      instructorOptions.value = res.content.map((u) => ({ id: u.id, label: u.email }))
    })
    .catch(() => {})
  window.addEventListener('click', closeColMenu)
})
onUnmounted(() => window.removeEventListener('click', closeColMenu))

const RUN_TONE: Record<RunStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  completed: 'success', partial: 'warning', failed: 'danger', skipped: 'info', processing: 'info',
}
const STATUS_LABEL: Record<RunStatus, string> = {
  completed: 'Completed', partial: 'Partial', failed: 'Failed', skipped: 'Skipped', processing: 'Processing',
}

const EVENT_ICON: Record<string, string> = {
  LINK_SUBMITTED: 'link', GATE_FAILED: 'x-circle', GATE_PASSED: 'check-circle-2',
  REFERENCE_ACCEPTED: 'clipboard-check', DISCARD_RESET: 'rotate-ccw', COHORT_LOCKED: 'lock',
  COHORT_UNLOCKED: 'lock-open', STOOD_UP: 'flag', CONFLICT_RESOLVED: 'git-merge',
}
function eventLabel(t: AuditEvent['eventType']): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function fmt(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16)
}

const SEASONS = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter']
/** Derive a readable term (e.g. "Autumn 2025") from the cohort's start date. */
function cohortTerm(cohortId: string | null): string {
  if (!cohortId) return ''
  const c = cohorts.list.find((x) => x.id === cohortId)
  if (!c?.startDate) return ''
  const d = new Date(c.startDate)
  if (Number.isNaN(d.getTime())) return ''
  return `${SEASONS[d.getMonth()]} ${d.getFullYear()}`
}
function fileKind(name: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') return 'Excel workbook'
  if (ext === 'csv') return 'CSV file'
  return 'Workbook'
}
function triggerWho(r: IngestionRun): string {
  return r.triggerType === 'SCHEDULED' ? 'System' : (r.triggeredByEmail ?? 'Admin')
}
function payloadPairs(p?: Record<string, unknown>): [string, string][] {
  return p ? Object.entries(p).map(([k, v]) => [k, String(v)]) : []
}
function toggleRun(id: string) {
  expandedRun.value = expandedRun.value === id ? null : id
}

// ── Runs: sorting ────────────────────────────────────────────────────────────
type SortKey = 'file' | 'cohort' | 'trigger' | 'status' | 'when'
const sortKey = ref<SortKey>('when')
const sortDir = ref<'asc' | 'desc'>('desc')
function toggleSort(k: SortKey) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = k
    sortDir.value = 'asc'
  }
}
const STATUS_ORDER: Record<RunStatus, number> = { failed: 0, partial: 1, processing: 2, completed: 3, skipped: 4 }
function sortVal(r: IngestionRun, k: SortKey): string | number {
  switch (k) {
    case 'file': return r.workbookFilename.toLowerCase()
    case 'cohort': return (r.cohortName ?? '').toLowerCase()
    case 'trigger': return r.triggerType
    case 'status': return STATUS_ORDER[r.status]
    case 'when': return r.runAt
  }
}
const searchedRuns = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return audit.runs
  return audit.runs.filter(
    (r) =>
      r.workbookFilename.toLowerCase().includes(q) ||
      (r.cohortName ?? '').toLowerCase().includes(q) ||
      (r.triggeredByEmail ?? '').toLowerCase().includes(q),
  )
})
const filteredEvents = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return audit.events
  return audit.events.filter(
    (e) =>
      eventLabel(e.eventType).toLowerCase().includes(q) ||
      (e.cohortName ?? '').toLowerCase().includes(q) ||
      (e.actorEmail ?? '').toLowerCase().includes(q),
  )
})
const sortedRuns = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...searchedRuns.value].sort((a, b) => {
    const av = sortVal(a, sortKey.value)
    const bv = sortVal(b, sortKey.value)
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return cmp * dir
  })
})

// ── Runs: pagination ──────────────────────────────────────────────────────────
const pageSize = ref(10)
const currentPage = ref(1)
const total = computed(() => sortedRuns.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const safePage = computed(() => Math.min(currentPage.value, totalPages.value))
const pagedRuns = computed(() => {
  const start = (safePage.value - 1) * pageSize.value
  return sortedRuns.value.slice(start, start + pageSize.value)
})
const showingFrom = computed(() => (total.value === 0 ? 0 : (safePage.value - 1) * pageSize.value + 1))
const showingTo = computed(() => Math.min(safePage.value * pageSize.value, total.value))
const pageItems = computed<(number | '…')[]>(() => {
  const tp = totalPages.value
  const cur = safePage.value
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const items: (number | '…')[] = []
  if (cur <= 4) {
    // Near the start: 1 2 3 4 5 … last
    for (let i = 1; i <= 5; i++) items.push(i)
    items.push('…', tp)
  } else if (cur >= tp - 3) {
    // Near the end: 1 … last-4 … last
    items.push(1, '…')
    for (let i = tp - 4; i <= tp; i++) items.push(i)
  } else {
    // Middle: 1 … cur-1 cur cur+1 … last
    items.push(1, '…', cur - 1, cur, cur + 1, '…', tp)
  }
  return items
})
function goToPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
}
watch([pageSize, search, () => audit.runs.length], () => {
  currentPage.value = 1
})

// ── Runs: manage columns ──────────────────────────────────────────────────────
const cols = ref({ cohort: true, trigger: true, status: true, when: true })
const COL_LABELS: { key: keyof typeof cols.value; label: string }[] = [
  { key: 'cohort', label: 'Cohort' },
  { key: 'trigger', label: 'Trigger' },
  { key: 'status', label: 'Status' },
  { key: 'when', label: 'When' },
]
const colCount = computed(() => 1 + Object.values(cols.value).filter(Boolean).length + 1)
const showColMenu = ref(false)
const colMenuPos = ref<{ top: number; left: number } | null>(null)
function toggleColMenu(event: MouseEvent) {
  event.stopPropagation()
  showColMenu.value = !showColMenu.value
  if (showColMenu.value) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    colMenuPos.value = { top: rect.bottom + 6, left: rect.right - 200 }
  }
}
function closeColMenu() {
  showColMenu.value = false
  showDateMenu.value = false
}

// ── Export ──────────────────────────────────────────────────────────────────
function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function downloadCsv(filename: string, header: string[], body: string[]) {
  const csv = [header.map(csvCell).join(','), ...body].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
function exportCsv() {
  closeColMenu()
  if (tab.value === 'runs') {
    if (!sortedRuns.value.length) {
      toast.show({ tone: 'info', title: 'Nothing to export', body: 'No runs match these filters.' })
      return
    }
    const body = sortedRuns.value.map((r) =>
      [
        r.workbookFilename,
        r.cohortName ?? '',
        r.triggerType === 'SCHEDULED' ? 'Scheduled' : 'Manual',
        r.triggerType === 'SCHEDULED' ? 'System' : (r.triggeredByEmail ?? 'Admin'),
        r.status,
        r.counts.rowsRead,
        r.counts.committedNew,
        r.counts.updated,
        r.counts.skippedInvalid,
        r.counts.conflicts,
        r.runAt,
      ].map(csvCell).join(','),
    )
    downloadCsv('audit-runs.csv', ['File', 'Cohort', 'Trigger', 'Triggered by', 'Status', 'Rows read', 'New', 'Updated', 'Invalid', 'Conflicts', 'When'], body)
    toast.show({ tone: 'success', title: 'Export ready', body: `${sortedRuns.value.length} run(s) exported to CSV.` })
  } else {
    if (!filteredEvents.value.length) {
      toast.show({ tone: 'info', title: 'Nothing to export', body: 'No events match these filters.' })
      return
    }
    const body = filteredEvents.value.map((e) =>
      [eventLabel(e.eventType), e.cohortName ?? '', e.actorEmail ?? 'SYSTEM', e.occurredAt].map(csvCell).join(','),
    )
    downloadCsv('audit-events.csv', ['Event', 'Cohort', 'Actor', 'When'], body)
    toast.show({ tone: 'success', title: 'Export ready', body: `${filteredEvents.value.length} event(s) exported to CSV.` })
  }
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
  <div class="audit-filters">
    <div class="search af-search">
      <VIcon name="search" :size="16" style="color: var(--text-muted)" />
      <input v-model="search" type="search" placeholder="Search runs…" aria-label="Search runs" />
    </div>

    <div class="af-row">
      <div class="selectf">
        <span class="selectf-label">Cohort</span>
        <div class="af-select">
          <select v-model="f.cohortId" @change="applyFilters">
            <option value="">All</option>
            <option v-for="c in cohorts.list" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <VIcon name="chevron-down" :size="16" class="af-chev" />
        </div>
      </div>

      <div class="selectf">
        <span class="selectf-label">Status</span>
        <div class="af-select">
          <select v-model="f.status" @change="applyFilters">
            <option value="">All</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
          <VIcon name="chevron-down" :size="16" class="af-chev" />
        </div>
      </div>

      <div class="selectf af-daterange-wrap">
        <span class="selectf-label">Date range</span>
        <button type="button" class="af-field" @click="toggleDateMenu">
          <span :class="{ 'af-placeholder': !dateRangeLabel }">{{ dateRangeLabel || 'Select range' }}</span>
          <VIcon name="calendar" :size="16" class="af-chev" />
        </button>
        <div v-if="showDateMenu" class="af-date-pop" @click.stop>
          <label class="af-date-fld">
            <span>From</span>
            <input v-model="f.dateFrom" type="date" @change="applyFilters" />
          </label>
          <label class="af-date-fld">
            <span>To</span>
            <input v-model="f.dateTo" type="date" @change="applyFilters" />
          </label>
          <button class="pop-clear" @click="clearDates">Clear dates</button>
        </div>
      </div>

      <div class="selectf">
        <span class="selectf-label">Instructor ID</span>
        <div class="af-select">
          <select v-model="f.instructorId" @change="applyFilters">
            <option value="">All</option>
            <option v-for="ins in instructorOptions" :key="ins.id" :value="ins.id">{{ ins.label }}</option>
          </select>
          <VIcon name="chevron-down" :size="16" class="af-chev" />
        </div>
      </div>

      <button type="button" class="af-reset" @click="resetFilters">
        <VIcon name="rotate-ccw" :size="15" />
        Reset filters
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs" role="tablist">
    <button :class="['tab', { on: tab === 'runs' }]" role="tab" :aria-selected="tab === 'runs'" @click="tab = 'runs'">
      Ingestion runs <span class="count-badge mono">{{ searchedRuns.length }}</span>
    </button>
    <button :class="['tab', { on: tab === 'events' }]" role="tab" :aria-selected="tab === 'events'" @click="tab = 'events'">
      Lifecycle events <span class="count-badge mono">{{ filteredEvents.length }}</span>
    </button>
  </div>

  <div v-if="audit.loading" class="muted">Loading audit log…</div>

  <!-- Runs tab -->
  <div v-else-if="tab === 'runs'" class="tbl-wrap">
    <div class="tbl-toolbar">
      <span class="tb-hint">{{ total }} run{{ total === 1 ? '' : 's' }}</span>
      <div class="tb-actions">
        <VButton size="sm" variant="ghost" icon="columns-3" @click="toggleColMenu">Manage columns</VButton>
        <VButton size="sm" variant="dark" icon="download" @click="exportCsv">Export</VButton>
      </div>
    </div>
    <table class="tbl">
      <thead>
        <tr>
          <th>
            <button class="th-sort" @click="toggleSort('file')">File
              <VSortIcon :active="sortKey === 'file'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.cohort">
            <button class="th-sort" @click="toggleSort('cohort')">Cohort
              <VSortIcon :active="sortKey === 'cohort'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.trigger">
            <button class="th-sort" @click="toggleSort('trigger')">Trigger
              <VSortIcon :active="sortKey === 'trigger'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.status">
            <button class="th-sort" @click="toggleSort('status')">Status
              <VSortIcon :active="sortKey === 'status'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.when">
            <button class="th-sort" @click="toggleSort('when')">When
              <VSortIcon :active="sortKey === 'when'" :dir="sortDir" />
            </button>
          </th>
          <th aria-hidden="true"></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="r in pagedRuns" :key="r.id">
          <tr class="row-click" @click="toggleRun(r.id)">
            <td>
              <div class="file-cell">
                <span class="file-ic"><VIcon name="file-spreadsheet" :size="18" /></span>
                <span class="file-meta">
                  <span class="file-name">
                    {{ r.workbookFilename }}
                    <VIcon v-if="r.highFailure" name="alert-triangle" :size="13" class="hi-fail" aria-label="High failure rate" />
                  </span>
                  <span class="file-sub">{{ fileKind(r.workbookFilename) }}</span>
                </span>
              </div>
            </td>
            <td v-if="cols.cohort">
              <span class="cohort-name">{{ r.cohortName ?? '—' }}</span>
              <span v-if="cohortTerm(r.cohortId)" class="cohort-term">{{ cohortTerm(r.cohortId) }}</span>
            </td>
            <td v-if="cols.trigger">
              <span class="trigger-cell">
                <VIcon :name="r.triggerType === 'SCHEDULED' ? 'calendar-clock' : 'user'" :size="15" class="trigger-ic" />
                <span>
                  {{ r.triggerType === 'SCHEDULED' ? 'Scheduled' : 'Manual' }}
                  <span class="muted">· {{ triggerWho(r) }}</span>
                </span>
              </span>
            </td>
            <td v-if="cols.status"><VPill :tone="RUN_TONE[r.status]" style="display: inline-flex; align-items: center; gap: 6px">{{ STATUS_LABEL[r.status] }}</VPill></td>
            <td v-if="cols.when">
              <span class="when-cell">
                <span class="when-date">{{ r.runAt.slice(0, 10) }}</span>
                <span class="when-time">{{ r.runAt.slice(11, 16) }}</span>
              </span>
            </td>
            <td style="text-align: right; width: 44px"><VIcon :name="expandedRun === r.id ? 'chevron-down' : 'chevron-right'" :size="18" class="muted" /></td>
          </tr>
          <tr v-if="expandedRun === r.id" class="detail-row">
            <td :colspan="colCount">
              <div class="run-detail">
                <div class="rd-counts mono">
                  {{ r.counts.rowsRead }} read · {{ r.counts.committedNew }} new · {{ r.counts.updated }} updated ·
                  {{ r.counts.skippedInvalid }} invalid · {{ r.counts.skippedUnchanged }} unchanged · {{ r.counts.conflicts }} conflicts
                </div>
                <div v-if="r.sharepointVersionId" class="rd-meta mono muted">version {{ r.sharepointVersionId }} · hash {{ r.quickXorHash }}</div>
                <div v-if="r.errorReport.length" class="rd-errors">
                  <p class="rd-errors-title">Rejected rows</p>
                  <ul class="err-list">
                    <li v-for="(e, i) in r.errorReport" :key="i" class="mono err-item">
                      {{ [e.sheet, e.row != null ? `row ${e.row}` : '', e.rule].filter(Boolean).join(' · ') }} — {{ e.message }}
                    </li>
                  </ul>
                </div>
                <VButton size="sm" variant="ghost" icon-right="arrow-right" @click.stop="router.push({ name: 'admin-run-review', params: { id: r.id } })">Open run review</VButton>
              </div>
            </td>
          </tr>
        </template>
        <tr v-if="total === 0"><td :colspan="colCount"><div class="empty-inline"><VIcon name="scroll-text" :size="24" class="muted" /><p class="empty-sub">No runs match these filters.</p></div></td></tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div v-if="total > 0" class="pager">
      <span class="pager-count">Showing <span class="pg-strong">{{ showingFrom }}</span> to <span class="pg-strong">{{ showingTo }}</span> of <span class="pg-strong">{{ total }}</span> Entries</span>
      <div class="pager-right">
        <div class="pgsize">
          <select v-model.number="pageSize" aria-label="Rows per page">
            <option :value="10">10 per page</option>
            <option :value="25">25 per page</option>
            <option :value="50">50 per page</option>
          </select>
        </div>
        <div class="pager-ctrls">
          <button class="pg-arrow" aria-label="Previous page" :disabled="safePage === 1" @click="goToPage(safePage - 1)"><VIcon name="chevron-left" :size="16" /></button>
          <template v-for="(p, i) in pageItems" :key="i">
            <span v-if="p === '…'" class="pg-ellipsis">…</span>
            <button v-else :class="['pg-num', { on: safePage === p }]" @click="goToPage(Number(p))">{{ p }}</button>
          </template>
          <button class="pg-arrow" aria-label="Next page" :disabled="safePage === totalPages" @click="goToPage(safePage + 1)"><VIcon name="chevron-right" :size="16" /></button>
        </div>
      </div>
    </div>
  </div>

  <!-- Events tab -->
  <template v-else>
    <div v-if="filteredEvents.length > 0" class="events-toolbar">
      <span class="muted" style="font-size: 13px">{{ filteredEvents.length }} event{{ filteredEvents.length === 1 ? '' : 's' }}</span>
      <VButton size="sm" variant="dark" icon="download" @click="exportCsv">Export</VButton>
    </div>
    <div class="event-list">
      <div v-for="e in filteredEvents" :key="e.id" class="event-row">
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
      <div v-if="filteredEvents.length === 0" class="empty-inline"><VIcon name="scroll-text" :size="24" class="muted" /><p class="empty-sub">No events match these filters.</p></div>
    </div>
  </template>

  <!-- Manage columns popover -->
  <Teleport to="body">
    <div v-if="showColMenu && colMenuPos" class="pop col-pop" :style="{ top: `${colMenuPos.top}px`, left: `${colMenuPos.left}px` }" @click.stop>
      <p class="pop-title">Manage columns</p>
      <label v-for="c in COL_LABELS" :key="c.key" class="pop-row">
        <input type="checkbox" v-model="cols[c.key]" />
        {{ c.label }}
      </label>
    </div>
  </Teleport>
</template>

<style scoped>
.page-sub { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }
.muted { color: var(--text-secondary); }

/* Filter panel — search row + control row (Cohort · Status · Date range · Instructor · Reset) */
.audit-filters { margin-bottom: 20px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); }
.af-search { width: 320px; max-width: 100%; margin-bottom: 16px; }
.af-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; }
.af-select { position: relative; display: flex; align-items: center; }
.af-select select { appearance: none; -webkit-appearance: none; height: 40px; min-width: 150px; padding: 0 36px 0 12px; border: 1px solid var(--border); border-radius: var(--r-lg); background: #fff; font-family: inherit; font-size: 14px; color: var(--text); cursor: pointer; }
.af-select select:focus-visible { outline: none; border-color: var(--orange); box-shadow: var(--ring-focus); }
.af-chev { position: absolute; right: 12px; pointer-events: none; color: var(--text-secondary); }

.af-daterange-wrap { position: relative; }
.af-field { display: inline-flex; align-items: center; justify-content: space-between; gap: 10px; height: 40px; min-width: 170px; padding: 0 12px; border: 1px solid var(--border); border-radius: var(--r-lg); background: #fff; font-family: inherit; font-size: 14px; color: var(--text); cursor: pointer; }
.af-field .af-chev { position: static; }
.af-placeholder { color: var(--text-muted); }
.af-date-pop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 1000; display: flex; flex-direction: column; gap: 10px; padding: 14px; background: #fff; border: 1px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow-pop); min-width: 220px; }
.af-date-fld { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary); }
.af-date-fld input { height: 38px; border: 1px solid var(--border); border-radius: var(--r-sm); background: #fff; padding: 0 10px; font-family: var(--font-mono); font-size: 14px; color: var(--text); }
.af-date-fld input:focus-visible { outline: none; border-color: var(--orange); box-shadow: var(--ring-focus); }

.af-reset { display: inline-flex; align-items: center; gap: 7px; height: 40px; margin-left: auto; padding: 0 12px; border: none; background: none; font-family: inherit; font-size: 14px; font-weight: 500; color: var(--text-secondary); cursor: pointer; }
.af-reset:hover { color: var(--orange-deep); }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
.tab { background: none; border: none; padding: 10px 16px; font-family: inherit; font-size: 14px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; display: flex; align-items: center; gap: 8px; }
.tab.on { color: var(--navy); border-bottom-color: var(--orange); }
.count-badge { font-size: 11px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; color: var(--text-secondary); }

.events-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.row-click { cursor: pointer; }
.detail-row td { background: var(--bg); }

/* Rich run-row cells (matches the Grading runs table) */
.file-cell { display: flex; align-items: center; gap: 12px; }
.file-ic { width: 34px; height: 34px; border-radius: 8px; background: #1e6e43; color: #fff; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.file-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.file-name { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; color: var(--text); }
.file-sub { font-size: 12px; color: var(--text-secondary); }
.hi-fail { color: var(--warning); flex-shrink: 0; }
.cohort-name { font-weight: 600; font-size: 14px; }
.cohort-term { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.trigger-cell { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
.trigger-ic { color: var(--text-secondary); flex-shrink: 0; }
.when-cell { display: flex; flex-direction: column; gap: 3px; }
.when-date { font-size: 13px; color: var(--text); }
.when-time { font-size: 13px; color: var(--text-secondary); }
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
