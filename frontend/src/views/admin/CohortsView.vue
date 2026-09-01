<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VSortIcon from '@/components/base/VSortIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import VDatePicker from '@/components/base/VDatePicker.vue'
import VTablePager from '@/components/base/VTablePager.vue'
import VRowActions from '@/components/base/VRowActions.vue'
import VPopover from '@/components/base/VPopover.vue'
import VEmptyState from '@/components/base/VEmptyState.vue'
import { useCohortsStore } from '@/stores/cohorts'
import { useToastStore } from '@/stores/toast'
import { toErrorMessage } from '@/utils/errors'
import { usePageTitle } from '@/composables/usePageTitle'
import { useQueryParam } from '@/composables/useQueryParam'
import { loadColumns, saveColumns, loadPageSize, savePageSize } from '@/utils/uiPrefs'
import { PAGE_SIZE_OPTIONS } from '@/utils/pagination'
import { fmtDate } from '@/utils/datetime'
import { cohortDisplayState, type Cohort, type CohortDisplayState } from '@/types/domain.types'

usePageTitle('Cohorts')

const router = useRouter()
const store = useCohortsStore()
const toast = useToastStore()

onMounted(() => {
  store.fetchList()
})

// ── State chip ────────────────────────────────────────────────────────────────
const CHIP: Record<CohortDisplayState, { tone: 'info' | 'warning' | 'success'; label: string }> = {
  DRAFT: { tone: 'info', label: 'Draft' },
  REFERENCE_ACCEPTED: { tone: 'warning', label: 'Reference accepted' },
  STOOD_UP: { tone: 'success', label: 'Stood up' },
  LOCKED: { tone: 'success', label: 'Locked' },
}
const chipFor = (c: Cohort) => CHIP[cohortDisplayState(c)]
const STATE_ORDER: Record<CohortDisplayState, number> = {
  DRAFT: 0,
  REFERENCE_ACCEPTED: 1,
  STOOD_UP: 2,
  LOCKED: 3,
}
const STATE_OPTIONS: { key: CohortDisplayState; label: string }[] = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'REFERENCE_ACCEPTED', label: 'Reference accepted' },
  { key: 'STOOD_UP', label: 'Stood up' },
  { key: 'LOCKED', label: 'Locked' },
]

// ── Search + filter ─────────────────────────────────────────────────────────
const search = ref('')
const stateFilter = ref<Set<CohortDisplayState>>(new Set())
const activeFilterCount = computed(() => stateFilter.value.size)

function toggleState(key: CohortDisplayState) {
  const next = new Set(stateFilter.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  stateFilter.value = next
}
function clearFilter() {
  stateFilter.value = new Set()
}

// ── Column visibility ────────────────────────────────────────────────────────
const COLS_KEY = 'validata.cohorts.columns'
const cols = ref(loadColumns(COLS_KEY, { start: true, end: true, state: true }))
watch(cols, (v) => saveColumns(COLS_KEY, v), { deep: true })
const COL_LABELS: { key: keyof typeof cols.value; label: string }[] = [
  { key: 'start', label: 'Start date' },
  { key: 'end', label: 'End date' },
  { key: 'state', label: 'State' },
]
const colCount = computed(() => 1 + Object.values(cols.value).filter(Boolean).length + 1) // name + toggled + actions

// ── Popovers (filter + columns) ──────────────────────────────────────────────
const showFilterMenu = ref(false)
const filterAnchor = ref<HTMLElement | null>(null)
const showColMenu = ref(false)
const colAnchor = ref<HTMLElement | null>(null)

function toggleFilterMenu(event: MouseEvent) {
  event.stopPropagation()
  showColMenu.value = false
  activeKebabId.value = null
  filterAnchor.value = event.currentTarget as HTMLElement
  showFilterMenu.value = !showFilterMenu.value
}
function toggleColMenu(event: MouseEvent) {
  event.stopPropagation()
  showFilterMenu.value = false
  activeKebabId.value = null
  colAnchor.value = event.currentTarget as HTMLElement
  showColMenu.value = !showColMenu.value
}

// ── Row actions (kebab) ────────────────────────────────────────────────────────
const activeKebabId = ref<string | null>(null)
function onKebabToggle({ id }: { id: string; anchor: HTMLElement }) {
  showFilterMenu.value = false
  showColMenu.value = false
  activeKebabId.value = id
}
function openFromKebab(c: Cohort) {
  activeKebabId.value = null
  openCohort(c)
}
async function copyFolderLink(c: Cohort) {
  activeKebabId.value = null
  if (!c.sharepointFolderUrl) {
    toast.show({ tone: 'info', title: 'No folder link', body: 'This cohort has no SharePoint folder URL yet.' })
    return
  }
  try {
    await navigator.clipboard.writeText(c.sharepointFolderUrl)
    toast.show({ tone: 'success', title: 'Link copied', body: 'SharePoint folder URL copied to clipboard.' })
  } catch {
    toast.show({ tone: 'warning', title: 'Copy failed', body: 'Could not access the clipboard.' })
  }
}

// ── Sorting ──────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'start' | 'end' | 'state'
const sortKey = ref<SortKey>('start')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}
function sortValue(c: Cohort, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return c.name.toLowerCase()
    case 'start':
      return c.startDate
    case 'end':
      return c.endDate
    case 'state':
      return STATE_ORDER[cohortDisplayState(c)]
  }
}

// ── URL query sync (search / state filter / sort / page survive reloads and shares) ──
const currentPage = ref(1)
const STATE_KEYS = new Set(STATE_OPTIONS.map((o) => o.key))
function parseStr(raw: string | undefined): string {
  return raw ?? ''
}
function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}
function parseStateFilter(raw: string | undefined): Set<CohortDisplayState> {
  if (!raw) return new Set()
  return new Set(raw.split(',').filter((k): k is CohortDisplayState => STATE_KEYS.has(k as CohortDisplayState)))
}
function encodeStateFilter(v: Set<CohortDisplayState>): string | null {
  return v.size ? [...v].join(',') : null
}
function parseSortKey(raw: string | undefined): SortKey {
  return (['name', 'start', 'end', 'state'] as const).includes(raw as SortKey) ? (raw as SortKey) : 'start'
}
function parseSortDir(raw: string | undefined): 'asc' | 'desc' {
  return raw === 'asc' ? 'asc' : 'desc'
}
useQueryParam({ key: 'q', target: search, parse: parseStr, encode: (v) => v.trim() || null })
useQueryParam({ key: 'state', target: stateFilter, parse: parseStateFilter, encode: encodeStateFilter })
useQueryParam({
  key: 'page',
  target: currentPage,
  parse: parsePage,
  encode: (v) => (v > 1 ? String(v) : null),
})
useQueryParam({ key: 'sort', target: sortKey, parse: parseSortKey, encode: (v) => (v !== 'start' ? v : null) })
useQueryParam({ key: 'dir', target: sortDir, parse: parseSortDir, encode: (v) => (v !== 'desc' ? v : null) })

// ── Derived: filter → sort → paginate ────────────────────────────────────────
const filtered = computed(() =>
  store.list.filter((c) => {
    const q = search.value.trim().toLowerCase()
    const matchesSearch = !q || c.name.toLowerCase().includes(q)
    const matchesState = stateFilter.value.size === 0 || stateFilter.value.has(cohortDisplayState(c))
    return matchesSearch && matchesState
  }),
)
const sorted = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filtered.value].sort((a, b) => {
    const av = sortValue(a, sortKey.value)
    const bv = sortValue(b, sortKey.value)
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return cmp * dir
  })
})

// ── Pagination ───────────────────────────────────────────────────────────────
const PAGESIZE_KEY = 'validata.cohorts.pageSize'
const pageSize = ref(loadPageSize(PAGESIZE_KEY, 10, PAGE_SIZE_OPTIONS))
watch(pageSize, (v) => savePageSize(PAGESIZE_KEY, v))
const total = computed(() => sorted.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const safePage = computed(() => Math.min(currentPage.value, totalPages.value))
const paged = computed(() => {
  const start = (safePage.value - 1) * pageSize.value
  return sorted.value.slice(start, start + pageSize.value)
})
// Page size changes are handled by VTablePager itself (it recalculates a page that
// keeps the visible range roughly stable) — only reset to page 1 on actual filtering.
watch([search, stateFilter], () => {
  currentPage.value = 1
})

// ── Row navigation: DRAFT/REFERENCE_ACCEPTED → stand-up; STOOD_UP → detail ──────
function openCohort(c: Cohort) {
  const name = c.lifecycleState === 'STOOD_UP' ? 'admin-cohort-detail' : 'admin-cohort-standup'
  router.push({ name, params: { id: c.id } })
}

// ── Create drawer ──────────────────────────────────────────────────────────────
const showDrawer = ref(false)
const submitting = ref(false)
const form = ref({ name: '', startDate: '', endDate: '' })
const formError = ref('')

const dateRangeError = computed(() => {
  if (!form.value.startDate || !form.value.endDate) return ''
  return form.value.endDate < form.value.startDate ? 'End date must be after start date.' : ''
})

function openCreate() {
  form.value = { name: '', startDate: '', endDate: '' }
  formError.value = ''
  showDrawer.value = true
}
function closeDrawer() {
  showDrawer.value = false
}
async function submit() {
  formError.value = ''
  if (!form.value.name.trim() || !form.value.startDate || !form.value.endDate) {
    formError.value = 'Name, start date, and end date are required.'
    return
  }
  if (dateRangeError.value) {
    formError.value = dateRangeError.value
    return
  }
  submitting.value = true
  try {
    const cohort = await store.createCohort({
      name: form.value.name.trim(),
      startDate: form.value.startDate,
      endDate: form.value.endDate,
    })
    toast.show({ tone: 'success', title: 'Cohort created', body: 'Point it at a SharePoint folder to begin stand-up.' })
    showDrawer.value = false
    router.push({ name: 'admin-cohort-standup', params: { id: cohort.id } })
  } catch (e) {
    formError.value = toErrorMessage(e, 'Failed to create cohort. Please try again.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1 class="page-title">Cohorts</h1>
      <p class="page-sub">Create a cohort, point it at its SharePoint folder, and run stand-up.</p>
    </div>
  </div>

  <!-- Error state -->
  <div v-if="store.error && !store.loading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load cohorts</p>
    <p class="load-error-sub">{{ store.error }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="store.fetchList()">Try again</VButton>
  </div>

  <div v-else class="tbl-wrap">
    <!-- Toolbar -->
    <div class="tbl-toolbar">
      <div class="tb-left">
        <div class="search">
          <VIcon name="search" :size="16" style="color: var(--text-muted)" />
          <input v-model="search" type="search" placeholder="Search cohorts" aria-label="Search cohorts" />
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
        <VButton size="sm" variant="primary" icon="plus" @click="openCreate">New cohort</VButton>
      </div>
    </div>

    <table class="tbl tbl-light cohorts-tbl">
      <thead>
        <tr>
          <th>
            <button class="th-sort" @click="toggleSort('name')">
              Cohort name
              <VSortIcon :active="sortKey === 'name'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.start">
            <button class="th-sort" @click="toggleSort('start')">
              Start date
              <VSortIcon :active="sortKey === 'start'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.end">
            <button class="th-sort" @click="toggleSort('end')">
              End date
              <VSortIcon :active="sortKey === 'end'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.state">
            <button class="th-sort" @click="toggleSort('state')">
              State
              <VSortIcon :active="sortKey === 'state'" :dir="sortDir" />
            </button>
          </th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>

      <tbody v-if="store.loading">
        <tr v-for="i in 4" :key="i" class="skel-row">
          <td><span class="skel" style="width: 55%" /></td>
          <td v-if="cols.start"><span class="skel" style="width: 80px" /></td>
          <td v-if="cols.end"><span class="skel" style="width: 80px" /></td>
          <td v-if="cols.state"><span class="skel" style="width: 74px; border-radius: 999px" /></td>
          <td class="col-actions"><span class="skel" style="width: 18px; display: inline-block" /></td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-for="c in paged" :key="c.id" class="row-click" @click="openCohort(c)">
          <td class="name-cell">
            <span class="cohort-name">
              {{ c.name }}
              <VIcon v-if="c.locked" name="lock" :size="13" class="lock-icon" aria-label="Locked" />
            </span>
          </td>
          <td v-if="cols.start" class="muted">{{ fmtDate(c.startDate) }}</td>
          <td v-if="cols.end" class="muted">{{ fmtDate(c.endDate) }}</td>
          <td v-if="cols.state">
            <VPill :tone="chipFor(c).tone" class="state-pill">{{ chipFor(c).label }}</VPill>
          </td>
          <td class="col-actions">
            <VRowActions :active-id="activeKebabId" :row-id="c.id" @toggle="onKebabToggle" @close="activeKebabId = null">
              <button class="pop-item" @click="openFromKebab(c)">
                <VIcon name="eye" :size="15" />
                {{ c.lifecycleState === 'STOOD_UP' ? 'View details' : 'Open stand-up' }}
              </button>
              <button v-if="c.sharepointFolderUrl" class="pop-item" @click="copyFolderLink(c)">
                <VIcon name="copy" :size="15" />
                Copy folder link
              </button>
            </VRowActions>
          </td>
        </tr>

        <tr v-if="paged.length === 0">
          <td :colspan="colCount">
            <VEmptyState
              icon="layers"
              :title="search || activeFilterCount ? 'No matching cohorts' : 'No cohorts yet'"
              :description="search || activeFilterCount ? 'Try adjusting your search or filters.' : 'Create a cohort to begin standing it up.'"
              :action-label="!search && !activeFilterCount ? 'New cohort' : undefined"
              @action="openCreate"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <VTablePager
      v-if="!store.loading && total > 0"
      :total="total"
      :page="safePage"
      :page-size="pageSize"
      @update:page="currentPage = $event"
      @update:pageSize="pageSize = $event"
    />
  </div>

  <!-- Filter popover -->
  <VPopover :open="showFilterMenu" :anchor="filterAnchor" @close="showFilterMenu = false">
    <div class="pop-head">
      <p class="pop-title">Filter by state</p>
      <button v-if="activeFilterCount > 0" class="pop-clear" @click="clearFilter">Clear</button>
    </div>
    <label v-for="opt in STATE_OPTIONS" :key="opt.key" class="pop-row">
      <input type="checkbox" :checked="stateFilter.has(opt.key)" @change="toggleState(opt.key)" />
      {{ opt.label }}
    </label>
  </VPopover>

  <!-- Manage columns popover -->
  <VPopover :open="showColMenu" :anchor="colAnchor" @close="showColMenu = false">
    <p class="pop-title">Manage columns</p>
    <label v-for="c in COL_LABELS" :key="c.key" class="pop-row">
      <input type="checkbox" v-model="cols[c.key]" />
      {{ c.label }}
    </label>
  </VPopover>

  <!-- Create drawer -->
  <VDrawer
    :open="showDrawer"
    title="New cohort"
    subtitle="A cohort is a time-bound group of learners. It starts as a draft — you'll add its SharePoint link next."
    :error="formError || undefined"
    @close="closeDrawer"
  >
    <label class="ff">
      <span class="ff-label">Cohort name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="form.name" placeholder="e.g. Cohort 9 — Spring 2026" />
      </span>
    </label>
    <div class="ff-row">
      <VDatePicker v-model="form.startDate" label="Start date" required :max="form.endDate || undefined" />
      <VDatePicker v-model="form.endDate" label="End date" required :min="form.startDate || undefined" :error="dateRangeError" />
    </div>
    <template #footer>
      <VButton variant="ghost" @click="closeDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submit">
        {{ submitting ? 'Creating…' : 'Create cohort' }}
      </VButton>
    </template>
  </VDrawer>
</template>

<style scoped>
.page-sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 4px;
}

/* ── Toolbar (search + filter · manage columns + export) ── */
.tbl-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.tb-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.tb-left .search {
  width: 260px;
  max-width: 100%;
}
.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}
.filter-btn:hover {
  background: var(--surface-alt);
}
.filter-btn.on {
  border-color: var(--navy);
  color: var(--navy);
}
.filter-btn:focus-visible {
  outline-color: var(--navy);
}
.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--r-pill);
  background: var(--navy);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.tb-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

/* ── Table typography (matching the design system's body font) ── */
.cohorts-tbl {
  width: 100%;
}
.cohorts-tbl tbody td {
  padding: 14px 16px;
}
.col-actions {
  width: 90px;
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
  font-weight: 500;
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
.name-cell {
  font-weight: 600;
}
.cohort-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.lock-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}
.muted {
  color: var(--text-secondary);
}

/* Status pill dot */
.state-pill .s-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

/* Popover content (VPopover/VRowActions render the anchored container itself;
   these style the slot content that still lives in this component's scope). */
.pop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  margin-bottom: 6px;
}
.pop-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin: 0;
}
.pop-head .pop-title {
  margin: 0;
}
.pop-clear {
  border: none;
  background: none;
  color: var(--navy);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.pop-clear:hover {
  color: var(--navy-2);
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
</style>
