<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VSortIcon from '@/components/base/VSortIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VTablePager from '@/components/base/VTablePager.vue'
import VRowActions from '@/components/base/VRowActions.vue'
import VPopover from '@/components/base/VPopover.vue'
import { useRunsStore } from '@/stores/runs'
import { useCohortsStore } from '@/stores/cohorts'
import { useToastStore } from '@/stores/toast'
import { useQueryParam } from '@/composables/useQueryParam'
import { usePageTitle } from '@/composables/usePageTitle'
import { loadColumns, saveColumns, loadPageSize, savePageSize } from '@/utils/uiPrefs'
import { PAGE_SIZE_OPTIONS } from '@/utils/pagination'
import { fmtDate as fmtDateLocal, fmtTime as fmtTimeLocal } from '@/utils/datetime'
import type { IngestionRun, RunStatus } from '@/types/run.types'

usePageTitle('Grading runs')

const router = useRouter()
const runs = useRunsStore()
const cohorts = useCohortsStore()
const toast = useToastStore()

// Column visibility survives reloads (previously reset every visit).
const COLS_KEY = 'validata.runs.columns'
const cols = ref(loadColumns(COLS_KEY, { cohort: true, trigger: true, status: true, results: true, when: true }))
watch(cols, (v) => saveColumns(COLS_KEY, v), { deep: true })

const selectedCohortId = ref('')

/**
 * `runs.list` (the shallow per-cohort job endpoint) never carries counts/failure data (§ FND-39) —
 * that comes from `runs.fetchStats`, scoped to exactly the runs on screen (§ FND-55: the previous
 * cohort-wide audit-log fetch had a fixed recency window that under-covered older runs). `paged` is
 * declared further down, but this function only reads it when actually called, well after setup runs.
 */
async function refreshStats() {
  await runs.fetchStats(paged.value)
}

async function loadRuns() {
  await Promise.all([runs.fetchList(), cohorts.fetchList()])
  await refreshStats()
  pollIfNeeded()
}

// ── Live-ish status (§ FND-38) ────────────────────────────────────────────────
// There's no SSE stream for the whole runs list (only a single in-progress run gets one, on its own
// review page) — so a row stuck on "Processing" never becomes "Completed"/"Failed" here without a
// manual reload. Silently re-poll on an interval while any row is still processing, and stop the
// moment none are — this only ever runs while there's actually something to wait on.
const POLL_INTERVAL_MS = 8000
let pollTimer: ReturnType<typeof setTimeout> | null = null

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function pollIfNeeded() {
  stopPolling()
  if (!runs.list.some((r) => r.status === 'processing')) return
  /**
   * Background poll tick — deliberately lighter than the initial `loadRuns`:
   * cohorts.fetchList() is skipped (the cohort roster can't meaningfully change
   * while the admin is staring at this table, and it's already loaded) so each
   * poll only re-hits the run lists + stats enrichment that can actually change.
   */
  pollTimer = setTimeout(async () => {
    await Promise.all([runs.fetchList(undefined, { silent: true }), refreshStats()])
    pollIfNeeded()
  }, POLL_INTERVAL_MS)
}

onMounted(() => {
  loadRuns()
})

onUnmounted(() => {
  stopPolling()
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
const showColMenu = ref(false)
const colMenuAnchor = ref<HTMLElement | null>(null)
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
  closeFilterMenu()
  activeKebabId.value = null
  colMenuAnchor.value = event.currentTarget as HTMLElement
  showColMenu.value = !showColMenu.value
}
function closeColMenu() {
  showColMenu.value = false
}

// ── Search + filter ──────────────────────────────────────────────────────────
const search = ref('')
const statusFilter = ref<Set<RunStatus>>(new Set())
const showFilterMenu = ref(false)
const filterMenuAnchor = ref<HTMLElement | null>(null)
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
  filterMenuAnchor.value = event.currentTarget as HTMLElement
  showFilterMenu.value = !showFilterMenu.value
}
function closeFilterMenu() {
  showFilterMenu.value = false
}

// ── Sorting ─────────────────────────────────────────────────────────────────
type SortKey = 'cohort' | 'trigger' | 'status' | 'results' | 'when'
const sortKey = ref<SortKey>('when')
const sortDir = ref<'asc' | 'desc'>('desc')

// Table state lives in the URL (q/page/sort) so filters survive reloads and
// filtered views can be shared as links — previously everything was lost.
// `currentPage` is declared here (ahead of the Pagination section below) because
// `useQueryParam` below binds to it immediately, not lazily.
const currentPage = ref(1)
function parseStr(raw: string | undefined): string {
  return raw ?? ''
}
function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}
function parseSortKey(raw: string | undefined): SortKey {
  return (['cohort', 'trigger', 'status', 'results', 'when'] as const).includes(raw as SortKey)
    ? (raw as SortKey)
    : 'when'
}
function parseSortDir(raw: string | undefined): 'asc' | 'desc' {
  return raw === 'asc' ? 'asc' : 'desc'
}
useQueryParam({ key: 'q', target: search, parse: parseStr, encode: (v) => v.trim() || null })
useQueryParam({
  key: 'page',
  target: currentPage,
  parse: parsePage,
  encode: (v) => (v > 1 ? String(v) : null),
})
useQueryParam({ key: 'sort', target: sortKey, parse: parseSortKey, encode: (v) => (v !== 'when' ? v : null) })
useQueryParam({ key: 'dir', target: sortDir, parse: parseSortDir, encode: (v) => (v !== 'desc' ? v : null) })

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
      return cohortLabel(r).toLowerCase()
    case 'trigger':
      return r.triggerType ?? ''
    case 'status':
      return STATUS_ORDER[r.status]
    case 'results': {
      const c = runs.stats.get(r.id)?.counts
      return (c?.committedNew ?? 0) + (c?.updated ?? 0)
    }
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
      const hay = `${cohortLabel(r)} ${triggerWho(r)} ${r.triggerType ?? ''} ${r.status}`.toLowerCase()
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
const PAGESIZE_KEY = 'validata.runs.pageSize'
const pageSize = ref(loadPageSize(PAGESIZE_KEY, 10, PAGE_SIZE_OPTIONS))
watch(pageSize, (v) => savePageSize(PAGESIZE_KEY, v))
const total = computed(() => sorted.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const safePage = computed(() => Math.min(currentPage.value, totalPages.value))
const paged = computed(() => {
  const start = (safePage.value - 1) * pageSize.value
  return sorted.value.slice(start, start + pageSize.value)
})

// § FND-55: `loadRuns`/the poll tick/`runSync` already call `refreshStats()` explicitly after they
// change `runs.list`, but paging/sorting/filtering/searching changes what's on screen without going
// through any of those — this covers that case too. `fetchStats` skips runs it already has (unless
// still processing), so this is a no-op whenever the visible set hasn't actually changed.
watch(paged, (p) => {
  runs.fetchStats(p)
})

// pageSize itself isn't listed here — VTablePager recomputes the landing page
// on a rows-per-page change so the visible range stays roughly stable instead
// of always snapping back to page 1.
watch([selectedCohortId, search, statusFilter], () => {
  currentPage.value = 1
})

// ── Kebab (row actions) ──────────────────────────────────────────────────────
const activeKebabId = ref<string | null>(null)

function onKebabToggle({ id }: { id: string; anchor: HTMLElement }) {
  showColMenu.value = false
  closeFilterMenu()
  activeKebabId.value = id
}

function closeKebab() {
  activeKebabId.value = null
}

// ── Formatting helpers ───────────────────────────────────────────────────────
/** Best available timestamp for a run (endpoints vary: runAt | completedAt | startedAt). */
function whenOf(r: IngestionRun): string | undefined {
  return r.runAt ?? r.completedAt ?? r.startedAt
}

const fmtDate = fmtDateLocal
const fmtTime = fmtTimeLocal

const SEASONS = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter']

// `filtered`/`sorted` re-run cohortLabel/cohortTerm for every row on every keystroke/sort/filter
// change — a linear cohorts.list.find() per call turns that into O(runs × cohorts) per re-render.
// Build the id→cohort lookup once and keep it current as the cohorts store updates.
const cohortById = computed(() => new Map(cohorts.list.map((c) => [c.id, c])))

/** Resolve a run's cohort display name from the cohorts store (the cohort list's `name` attribute). */
function cohortLabel(r: IngestionRun): string {
  return r.cohortName ?? cohortById.value.get(r.cohortId)?.name ?? '—'
}

/** Derive a readable term (e.g. "Autumn 2025") from the cohort's start date. */
function cohortTerm(cohortId: string): string {
  const c = cohortById.value.get(cohortId)
  if (!c?.startDate) return ''
  const d = new Date(c.startDate)
  if (Number.isNaN(d.getTime())) return ''
  return `${SEASONS[d.getMonth()]} ${d.getFullYear()}`
}

function triggerWho(r: IngestionRun): string {
  return r.triggerType === 'SCHEDULED' ? 'System' : (r.triggeredByEmail ?? 'Admin')
}

/** Real counts for a run (§ FND-39) — `r.counts` itself is never populated by `runs.list`'s own
 *  endpoint; `runs.stats` (fetched per run, scoped to what's on screen — § FND-55) has it. */
function resultsFor(r: IngestionRun) {
  return runs.stats.get(r.id)?.counts
}

/** Distinguishes "not fetched yet" from "fetched, and it's genuinely zero" (§ FND-55) — the Results
 *  cell must show a dash for the former, never the same digit a real zero-result run would show. */
function hasResults(r: IngestionRun): boolean {
  return runs.stats.has(r.id)
}

// ── Row actions ───────────────────────────────────────────────────────────────
function openRun(r: IngestionRun) {
  router.push({ name: 'admin-run-review', params: { id: r.syncJobId ?? r.id }, query: { cohortId: r.cohortId } })
}

async function copyLink(r: IngestionRun) {
  closeKebab()
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
    await refreshStats()
    pollIfNeeded() // the newly triggered run starts out "processing" — start watching for it to finish
  } catch {
    toast.show({ tone: 'warning', title: 'Sync failed', body: runs.actionError ?? 'Please try again.' })
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

  <!-- Cohort lookup or stats enrichment failed: stats/filtering degrade quietly, so surface it
       instead of silently omitting the STOOD_UP-based "needs attention" columns and cohort dropdown data. -->
  <div v-if="(cohorts.error || runs.statsError) && !runs.error && !runs.loading" class="load-slow-banner" style="margin-bottom: 16px">
    <VIcon name="alert-circle" :size="15" />
    {{ cohorts.error ? `Could not load cohorts: ${cohorts.error}` : `Run statistics unavailable: ${runs.statsError}` }}
  </div>

  <!-- Load error -->
  <div v-if="runs.error && !runs.loading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load runs</p>
    <p class="load-error-sub">{{ runs.error }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="loadRuns">Try again</VButton>
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
        <VButton size="sm" variant="primary" icon="refresh-cw" :disabled="runs.syncing" @click="runSync">
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
            <th class="col-kebab">Actions</th>
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
              <span class="cohort-name">{{ cohortLabel(r) }}</span>
              <span v-if="cohortTerm(r.cohortId)" class="cohort-term">{{ cohortTerm(r.cohortId) }}</span>
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
              <span v-if="hasResults(r)" class="counts">
                <span class="c-new">{{ resultsFor(r)?.committedNew ?? 0 }} new</span>
                <span class="sep">·</span>
                <span>{{ resultsFor(r)?.updated ?? 0 }} upd</span>
                <span class="sep">·</span>
                <span :class="{ 'c-bad': (resultsFor(r)?.skippedInvalid ?? 0) > 0 }">{{ resultsFor(r)?.skippedInvalid ?? 0 }} invalid</span>
                <span class="sep">·</span>
                <span :class="{ 'c-conflict': (resultsFor(r)?.conflicts ?? 0) > 0 }">{{ resultsFor(r)?.conflicts ?? 0 }} conflict</span>
              </span>
              <!-- § FND-55: not-yet-fetched is not the same as zero. -->
              <span v-else class="counts muted" title="Statistics not loaded for this run">—</span>
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
              <VRowActions :active-id="activeKebabId" :row-id="r.id" @toggle="onKebabToggle" @close="closeKebab">
                <button class="pop-item" @click="openRun(r)">
                  <VIcon name="eye" :size="15" />
                  View details
                </button>
                <button class="pop-item" @click="copyLink(r)">
                  <VIcon name="copy" :size="15" />
                  Copy file link
                </button>
              </VRowActions>
            </td>
          </tr>

          <!-- Empty -->
          <tr v-if="paged.length === 0">
            <td :colspan="colCount">
              <div class="empty-inline">
                <VIcon name="refresh-cw" :size="26" class="muted" />
                <p class="empty-title">No runs yet</p>
                <p class="empty-sub">Run a sync to ingest grading data for a stood-up cohort.</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <VTablePager
      v-if="!runs.loading && total > 0"
      :total="total"
      :page="safePage"
      :page-size="pageSize"
      @update:page="currentPage = $event"
      @update:pageSize="pageSize = $event"
    />
  </div>

  <!-- Filter popover -->
  <VPopover :open="showFilterMenu" :anchor="filterMenuAnchor" class="col-pop" @close="closeFilterMenu">
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
  </VPopover>

  <!-- Manage columns popover -->
  <VPopover :open="showColMenu" :anchor="colMenuAnchor" class="col-pop" @close="closeColMenu">
    <p class="pop-title">Manage columns</p>
    <label v-for="c in COL_LABELS" :key="c.key" class="pop-row">
      <input type="checkbox" v-model="cols[c.key]" />
      {{ c.label }}
    </label>
  </VPopover>
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
  border-color: var(--navy);
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
  color: var(--navy);
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
  border-color: var(--navy);
  box-shadow: var(--ring-focus);
}
.pg-arrow:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
  accent-color: var(--navy);
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
  border-color: var(--navy);
  box-shadow: var(--ring-focus);
}
</style>
