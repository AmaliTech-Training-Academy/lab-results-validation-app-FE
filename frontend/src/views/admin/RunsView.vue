<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VSortIcon from '@/components/base/VSortIcon.vue'
import VPill from '@/components/base/VPill.vue'
import { useRunsStore } from '@/stores/runs'
import { useCohortsStore } from '@/stores/cohorts'
import { useToastStore } from '@/stores/toast'
import type { IngestionRun, RunStatus } from '@/types/run.types'

const router = useRouter()
const runs = useRunsStore()
const cohorts = useCohortsStore()
const toast = useToastStore()

const selectedCohortId = ref('')

onMounted(() => {
  runs.fetchList()
  cohorts.fetchList()
  window.addEventListener('click', closeAllMenus)
})

onUnmounted(() => {
  window.removeEventListener('click', closeAllMenus)
})

/** Only STOOD_UP (incl. locked) cohorts are sync-eligible (B2 AC1). */
const eligibleCohorts = computed(() => cohorts.list.filter((c) => c.lifecycleState === 'STOOD_UP'))

// ── Status presentation ─────────────────────────────────────────────────────
const STATUS_TONE: Record<RunStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  completed: 'success',
  partial: 'warning',
  failed: 'danger',
  skipped: 'info',
  processing: 'info',
}
const STATUS_LABEL: Record<RunStatus, string> = {
  completed: 'Completed',
  partial: 'Partial',
  failed: 'Failed',
  skipped: 'Skipped',
  processing: 'Processing',
}
const STATUS_ORDER: Record<RunStatus, number> = {
  failed: 0,
  partial: 1,
  processing: 2,
  completed: 3,
  skipped: 4,
}

// ── Column visibility (Manage columns) ──────────────────────────────────────
const cols = ref({ cohort: true, trigger: true, status: true, results: true, when: true })
const showColMenu = ref(false)
const colMenuPos = ref<{ top: number; left: number } | null>(null)
const COL_LABELS: { key: keyof typeof cols.value; label: string }[] = [
  { key: 'cohort', label: 'Cohort' },
  { key: 'trigger', label: 'Trigger' },
  { key: 'status', label: 'Status' },
  { key: 'results', label: 'Results' },
  { key: 'when', label: 'When' },
]
const colCount = computed(
  () => Object.values(cols.value).filter(Boolean).length + 1, // toggled columns + kebab
)

function toggleColMenu(event: MouseEvent) {
  event.stopPropagation()
  showFilterMenu.value = false
  showColMenu.value = !showColMenu.value
  if (showColMenu.value) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    colMenuPos.value = { top: rect.bottom + 6, left: rect.right - 200 }
    activeKebabId.value = null
  }
}

// ── Search + filter ──────────────────────────────────────────────────────────
const search = ref('')
const statusFilter = ref<Set<RunStatus>>(new Set())
const showFilterMenu = ref(false)
const filterMenuPos = ref<{ top: number; left: number } | null>(null)
const STATUS_FILTER_OPTIONS: { key: RunStatus; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'partial', label: 'Partial' },
  { key: 'failed', label: 'Failed' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'processing', label: 'Processing' },
]
const activeFilterCount = computed(() => (selectedCohortId.value ? 1 : 0) + statusFilter.value.size)
function toggleStatusFilter(k: RunStatus) {
  const next = new Set(statusFilter.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  statusFilter.value = next
}
function clearFilter() {
  selectedCohortId.value = ''
  statusFilter.value = new Set()
}
function toggleFilterMenu(event: MouseEvent) {
  event.stopPropagation()
  showColMenu.value = false
  activeKebabId.value = null
  showFilterMenu.value = !showFilterMenu.value
  if (showFilterMenu.value) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    filterMenuPos.value = { top: rect.bottom + 6, left: rect.left }
  }
}

// ── Sorting ─────────────────────────────────────────────────────────────────
type SortKey = 'cohort' | 'trigger' | 'status' | 'results' | 'when'
const sortKey = ref<SortKey>('when')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'when' ? 'desc' : 'asc'
  }
}

function sortValue(r: IngestionRun, key: SortKey): string | number {
  switch (key) {
    case 'cohort':
      return (r.cohortName ?? '').toLowerCase()
    case 'trigger':
      return r.triggerType ?? ''
    case 'status':
      return STATUS_ORDER[r.status]
    case 'results':
      return (r.counts?.committedNew ?? 0) + (r.counts?.updated ?? 0)
    case 'when':
      return whenOf(r) ?? ''
  }
}

// ── Derived list: filter → sort → paginate ──────────────────────────────────
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return runs.list.filter((r) => {
    if (selectedCohortId.value && r.cohortId !== selectedCohortId.value) return false
    if (statusFilter.value.size && !statusFilter.value.has(r.status)) return false
    if (q) {
      const hay = `${r.cohortName ?? ''} ${triggerWho(r)} ${r.triggerType ?? ''} ${r.status}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

const sorted = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const av = sortValue(a, sortKey.value)
    const bv = sortValue(b, sortKey.value)
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return cmp * dir
  })
})

// ── Pagination ──────────────────────────────────────────────────────────────
const pageSize = ref(10)
const currentPage = ref(1)
const total = computed(() => sorted.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const safePage = computed(() => Math.min(currentPage.value, totalPages.value))
const paged = computed(() => {
  const start = (safePage.value - 1) * pageSize.value
  return sorted.value.slice(start, start + pageSize.value)
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

watch([selectedCohortId, pageSize, search, statusFilter], () => {
  currentPage.value = 1
})

// ── Kebab (row actions) ──────────────────────────────────────────────────────
const activeKebabId = ref<string | null>(null)
const kebabPos = ref<{ top: number; left: number } | null>(null)
const activeKebabRun = computed(() => runs.list.find((r) => r.id === activeKebabId.value) ?? null)

function toggleKebab(event: MouseEvent, id: string) {
  event.stopPropagation()
  if (activeKebabId.value === id) {
    closeAllMenus()
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  kebabPos.value = { top: rect.bottom + 4, left: rect.right - 180 }
  activeKebabId.value = id
  showColMenu.value = false
}

function closeAllMenus() {
  activeKebabId.value = null
  kebabPos.value = null
  showColMenu.value = false
  showFilterMenu.value = false
}

// ── Formatting helpers ───────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Best available timestamp for a run (endpoints vary: runAt | completedAt | startedAt). */
function whenOf(r: IngestionRun): string | undefined {
  return r.runAt ?? r.completedAt ?? r.startedAt
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
function fmtTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const SEASONS = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter']
/** Derive a readable term (e.g. "Autumn 2025") from the cohort's start date. */
function cohortTerm(cohortId: string): string {
  const c = cohorts.list.find((x) => x.id === cohortId)
  if (!c?.startDate) return ''
  const d = new Date(c.startDate)
  if (Number.isNaN(d.getTime())) return ''
  return `${SEASONS[d.getMonth()]} ${d.getFullYear()}`
}

function triggerWho(r: IngestionRun): string {
  return r.triggerType === 'SCHEDULED' ? 'System' : (r.triggeredByEmail ?? 'Admin')
}

// ── Row actions ───────────────────────────────────────────────────────────────
function openRun(r: IngestionRun) {
  router.push({ name: 'admin-run-review', params: { id: r.id } })
}

async function copyLink(r: IngestionRun) {
  closeAllMenus()
  if (!r.sharepointFileUrl) {
    toast.show({ tone: 'info', title: 'No file link', body: 'This run has no SharePoint URL recorded.' })
    return
  }
  try {
    await navigator.clipboard.writeText(r.sharepointFileUrl)
    toast.show({ tone: 'success', title: 'Link copied', body: 'SharePoint file URL copied to clipboard.' })
  } catch {
    toast.show({ tone: 'warning', title: 'Copy failed', body: 'Could not access the clipboard.' })
  }
}


// ── Sync ────────────────────────────────────────────────────────────────────
async function runSync() {
  try {
    await runs.sync(selectedCohortId.value || undefined)
    toast.show({ tone: 'success', title: 'Sync triggered', body: 'A new run has started.' })
  } catch {
    toast.show({ tone: 'warning', title: 'Sync failed', body: runs.error ?? 'Please try again.' })
  }
}
</script>

<template>
  <!-- Page header -->
  <div class="page-head">
    <div>
      <h1 class="page-title">Grading runs</h1>
      <p class="page-sub">SharePoint grading ingestion — scheduled weekly and on demand.</p>
    </div>
  </div>

  <!-- Load error -->
  <div v-if="runs.error && !runs.loading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load runs</p>
    <p class="load-error-sub">{{ runs.error }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="runs.fetchList()">Try again</VButton>
  </div>

  <!-- Runs card -->
  <div v-else class="tbl-wrap">
    <!-- Toolbar -->
    <div class="tbl-toolbar">
      <div class="tb-left">
        <div class="search">
          <VIcon name="search" :size="16" style="color: var(--text-muted)" />
          <input v-model="search" type="search" placeholder="Search runs" aria-label="Search runs" />
        </div>
        <button :class="['filter-btn', { on: activeFilterCount > 0 }]" @click="toggleFilterMenu">
          <VIcon name="list-filter" :size="16" />
          Filter
          <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
          <VIcon name="chevron-down" :size="14" style="color: var(--text-secondary)" />
        </button>
      </div>
      <div class="tb-actions">
        <VButton size="sm" variant="ghost" icon="columns-3" @click="toggleColMenu">Manage columns</VButton>
        <VButton size="sm" variant="dark" icon="refresh-cw" :disabled="runs.syncing" @click="runSync">
          {{ runs.syncing ? 'Syncing…' : selectedCohortId ? 'Sync cohort' : 'Run sync now' }}
        </VButton>
      </div>
    </div>

    <div class="tbl-scroll">
      <table class="tbl tbl-light runs-tbl">
        <thead>
          <tr>
            <th v-if="cols.cohort">
              <button class="th-sort" @click="toggleSort('cohort')">
                Cohort
                <VSortIcon :active="sortKey === 'cohort'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.trigger">
              <button class="th-sort" @click="toggleSort('trigger')">
                Trigger
                <VSortIcon :active="sortKey === 'trigger'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.status">
              <button class="th-sort" @click="toggleSort('status')">
                Status
                <VSortIcon :active="sortKey === 'status'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.results">
              <button class="th-sort" @click="toggleSort('results')">
                Results
                <VSortIcon :active="sortKey === 'results'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.when">
              <button class="th-sort" @click="toggleSort('when')">
                When
                <VSortIcon :active="sortKey === 'when'" :dir="sortDir" />
              </button>
            </th>
            <th class="col-kebab" aria-hidden="true"></th>
          </tr>
        </thead>

        <!-- Loading skeleton -->
        <tbody v-if="runs.loading">
          <tr v-for="i in 5" :key="i" class="skel-row">
            <td v-if="cols.cohort"><span class="skel" style="width: 80px" /></td>
            <td v-if="cols.trigger"><span class="skel" style="width: 110px" /></td>
            <td v-if="cols.status"><span class="skel" style="width: 74px; border-radius: 999px" /></td>
            <td v-if="cols.results"><span class="skel" style="width: 150px" /></td>
            <td v-if="cols.when"><span class="skel" style="width: 90px" /></td>
            <td class="col-kebab"></td>
          </tr>
        </tbody>

        <!-- Data -->
        <tbody v-else>
          <tr v-for="r in paged" :key="r.id" class="row-click" @click="openRun(r)">
            <!-- Cohort -->
            <td v-if="cols.cohort">
              <span class="cohort-name">{{ r.cohortName ?? '—' }}</span>
              <span v-if="cohortTerm(r.cohortId)" class="cohort-term">— {{ cohortTerm(r.cohortId) }}</span>
            </td>

            <!-- Trigger -->
            <td v-if="cols.trigger">
              <span class="trigger-cell">
                <VIcon :name="r.triggerType === 'SCHEDULED' ? 'calendar-clock' : 'user'" :size="15" class="trigger-ic" />
                <span>
                  {{ r.triggerType === 'SCHEDULED' ? 'Scheduled' : 'Manual' }}
                  <span class="muted">· {{ triggerWho(r) }}</span>
                </span>
              </span>
            </td>

            <!-- Status -->
            <td v-if="cols.status">
              <VPill :tone="STATUS_TONE[r.status]" class="status-pill">
                {{ STATUS_LABEL[r.status] }}
              </VPill>
            </td>

            <!-- Results -->
            <td v-if="cols.results">
              <span class="counts">
                <span class="c-new">{{ r.counts?.committedNew ?? 0 }} new</span>
                <span class="sep">·</span>
                <span>{{ r.counts?.updated ?? 0 }} upd</span>
                <span class="sep">·</span>
                <span :class="{ 'c-bad': (r.counts?.skippedInvalid ?? 0) > 0 }">{{ r.counts?.skippedInvalid ?? 0 }} invalid</span>
                <span class="sep">·</span>
                <span :class="{ 'c-conflict': (r.counts?.conflicts ?? 0) > 0 }">{{ r.counts?.conflicts ?? 0 }} conflict</span>
              </span>
            </td>

            <!-- When -->
            <td v-if="cols.when">
              <span class="when-cell">
                <span class="when-row"><VIcon name="calendar" :size="13" class="when-ic" />{{ fmtDate(whenOf(r)) }}</span>
                <span class="when-row muted"><VIcon name="clock" :size="13" class="when-ic" />{{ fmtTime(whenOf(r)) }}</span>
              </span>
            </td>

            <!-- Kebab -->
            <td class="col-kebab">
              <button class="kebab" aria-label="Row actions" @click="toggleKebab($event, r.id)">
                <VIcon name="more-vertical" :size="18" />
              </button>
            </td>
          </tr>

          <!-- Empty -->
          <tr v-if="paged.length === 0">
            <td :colspan="colCount">
              <div class="empty-inline">
                <VIcon name="refresh-cw" :size="26" class="muted" />
                <p class="empty-title">No runs yet</p>
                <p class="empty-sub">Trigger a sync to ingest grading data for a stood-up cohort.</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="!runs.loading && total > 0" class="pager">
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
          <button class="pg-arrow" aria-label="Previous page" :disabled="safePage === 1" @click="goToPage(safePage - 1)">
            <VIcon name="chevron-left" :size="16" />
          </button>
          <template v-for="(p, i) in pageItems" :key="i">
            <span v-if="p === '…'" class="pg-ellipsis">…</span>
            <button v-else :class="['pg-num', { on: safePage === p }]" @click="goToPage(Number(p))">{{ p }}</button>
          </template>
          <button class="pg-arrow" aria-label="Next page" :disabled="safePage === totalPages" @click="goToPage(safePage + 1)">
            <VIcon name="chevron-right" :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Filter popover -->
  <Teleport to="body">
    <div v-if="showFilterMenu && filterMenuPos" class="pop col-pop" :style="{ top: `${filterMenuPos.top}px`, left: `${filterMenuPos.left}px` }" @click.stop>
      <div class="pop-head">
        <p class="pop-title">Filter runs</p>
        <button v-if="activeFilterCount > 0" class="pop-clear" @click="clearFilter">Clear</button>
      </div>
      <div class="pop-field">
        <span class="pop-flabel">Cohort</span>
        <select v-model="selectedCohortId" class="pop-select">
          <option value="">All cohorts</option>
          <option v-for="c in eligibleCohorts" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <p class="pop-flabel" style="margin: 8px 0 2px; padding: 0 8px">Status</p>
      <label v-for="opt in STATUS_FILTER_OPTIONS" :key="opt.key" class="pop-row">
        <input type="checkbox" :checked="statusFilter.has(opt.key)" @change="toggleStatusFilter(opt.key)" />
        {{ opt.label }}
      </label>
    </div>
  </Teleport>

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

  <!-- Row actions popover -->
  <Teleport to="body">
    <div v-if="activeKebabRun && kebabPos" class="pop" :style="{ top: `${kebabPos.top}px`, left: `${kebabPos.left}px` }" @click.stop>
      <button class="pop-item" @click="openRun(activeKebabRun)">
        <VIcon name="eye" :size="15" />
        View details
      </button>
      <button class="pop-item" @click="copyLink(activeKebabRun)">
        <VIcon name="copy" :size="15" />
        Copy file link
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cohort-select {
  height: 44px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: #fff;
  padding: 0 12px;
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}
.cohort-select:focus-visible {
  outline: none;
  border-color: var(--orange);
  box-shadow: var(--ring-focus);
}

/* ── Toolbar ── */
.runs-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.tb-hint {
  font-size: 13px;
  color: var(--text-secondary);
}
.tb-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

/* ── Table shell ── */
/* Fluid: the table always fits its container — no horizontal scrollbar. */
.tbl-scroll {
  width: 100%;
}
.runs-tbl {
  width: 100%;
}
.runs-tbl tbody td {
  padding: 12px 16px;
}
.col-kebab {
  width: 48px;
  text-align: right;
}

/* Sortable header button */
.th-sort {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.th-sort:hover {
  color: var(--text);
}
.th-caret {
  color: var(--navy);
  opacity: 0.5;
}
.th-caret.on {
  color: var(--orange);
  opacity: 1;
}

/* Rows */
.row-click {
  cursor: pointer;
}
.muted {
  color: var(--text-secondary);
}

/* File cell */
.file-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}
.file-ic {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #1e6e43;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.file-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.file-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}
.file-sub {
  font-size: 12px;
  color: var(--text-secondary);
}
.hi-fail {
  color: var(--warning);
  flex-shrink: 0;
}

/* Cohort */
.cohort-name {
  font-weight: 600;
  font-size: 14px;
}
.cohort-term {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* Trigger */
.trigger-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.trigger-ic {
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* Status pill dot */
.status-pill .s-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

/* Results counts */
.counts {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.counts .sep {
  margin: 0 5px;
  opacity: 0.5;
}
.c-new {
  color: var(--success);
  font-weight: 600;
}
.c-bad {
  color: var(--danger);
  font-weight: 600;
}
.c-conflict {
  color: var(--warning);
  font-weight: 600;
}

/* When */
.when-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.when-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.when-ic {
  color: var(--text-muted);
  flex-shrink: 0;
}

/* Pagination extras */
.pager-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.pgsize select {
  height: 34px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--bg-sunken);
  padding: 0 10px;
  font-family: inherit;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
}
.pgsize select:focus-visible {
  outline: none;
  border-color: var(--orange);
  box-shadow: var(--ring-focus);
}
.pg-arrow:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Empty */
.empty-inline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 16px;
  text-align: center;
}
.empty-title {
  font-family: var(--font-display);
  font-weight: 600;
  margin: 0;
}
.empty-sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
}

/* Popovers (teleported) */
.pop {
  position: fixed;
  z-index: 1000;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-pop);
  min-width: 180px;
  overflow: hidden;
  padding: 4px;
}
.pop-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: none;
  border-radius: var(--r-sm);
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}
.pop-item:hover {
  background: var(--bg);
}
.pop-item :deep(svg) {
  color: var(--text-secondary);
}
.col-pop {
  min-width: 200px;
  padding: 10px 8px 8px;
}
.pop-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin: 0 0 6px;
  padding: 0 8px;
}
.pop-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--r-sm);
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}
.pop-row:hover {
  background: var(--bg);
}
.pop-row input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--orange);
}
.pop-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 8px;
  margin-bottom: 4px;
}
.pop-flabel {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.pop-select {
  height: 36px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: #fff;
  padding: 0 10px;
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}
.pop-select:focus-visible {
  outline: none;
  border-color: var(--orange);
  box-shadow: var(--ring-focus);
}
</style>
