<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VSortIcon from '@/components/base/VSortIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import VDatePicker from '@/components/base/VDatePicker.vue'
import { useCohortsStore } from '@/stores/cohorts'
import { useToastStore } from '@/stores/toast'
import { cohortDisplayState, type Cohort, type CohortDisplayState } from '@/types/domain.types'

const router = useRouter()
const store = useCohortsStore()
const toast = useToastStore()

onMounted(() => {
  store.fetchList()
  window.addEventListener('click', closeMenus)
})
onUnmounted(() => window.removeEventListener('click', closeMenus))

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
const cols = ref({ start: true, end: true, state: true })
const COL_LABELS: { key: keyof typeof cols.value; label: string }[] = [
  { key: 'start', label: 'Start date' },
  { key: 'end', label: 'End date' },
  { key: 'state', label: 'State' },
]
const colCount = computed(() => 1 + Object.values(cols.value).filter(Boolean).length + 1) // name + toggled + actions

// ── Popovers (filter + columns) ──────────────────────────────────────────────
const showFilterMenu = ref(false)
const filterMenuPos = ref<{ top: number; left: number } | null>(null)
const showColMenu = ref(false)
const colMenuPos = ref<{ top: number; left: number } | null>(null)

function toggleFilterMenu(event: MouseEvent) {
  event.stopPropagation()
  showColMenu.value = false
  showFilterMenu.value = !showFilterMenu.value
  if (showFilterMenu.value) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    filterMenuPos.value = { top: rect.bottom + 6, left: rect.left }
  }
}
function toggleColMenu(event: MouseEvent) {
  event.stopPropagation()
  showFilterMenu.value = false
  showColMenu.value = !showColMenu.value
  if (showColMenu.value) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    colMenuPos.value = { top: rect.bottom + 6, left: rect.right - 200 }
  }
}
function closeMenus() {
  showFilterMenu.value = false
  showColMenu.value = false
  activeKebabId.value = null
  kebabPos.value = null
}

// ── Row actions (kebab) ────────────────────────────────────────────────────────
const activeKebabId = ref<string | null>(null)
const kebabPos = ref<{ top: number; left: number } | null>(null)
const activeKebabCohort = computed(() => store.list.find((c) => c.id === activeKebabId.value) ?? null)
function toggleKebab(event: MouseEvent, id: string) {
  event.stopPropagation()
  showFilterMenu.value = false
  showColMenu.value = false
  if (activeKebabId.value === id) {
    activeKebabId.value = null
    kebabPos.value = null
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  kebabPos.value = { top: rect.bottom + 4, left: rect.right - 200 }
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
watch([search, pageSize, stateFilter], () => {
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
    formError.value = e instanceof Error ? e.message : 'Failed to create cohort. Please try again.'
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
        <VButton size="sm" variant="dark" icon="plus" @click="openCreate">New cohort</VButton>
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
          <td v-if="cols.start" class="muted">{{ c.startDate }}</td>
          <td v-if="cols.end" class="muted">{{ c.endDate }}</td>
          <td v-if="cols.state">
            <VPill :tone="chipFor(c).tone" class="state-pill">{{ chipFor(c).label }}</VPill>
          </td>
          <td class="col-actions">
            <button class="kebab" aria-label="Row actions" @click.stop="toggleKebab($event, c.id)">
              <VIcon name="more-vertical" :size="18" />
            </button>
          </td>
        </tr>

        <tr v-if="paged.length === 0">
          <td :colspan="colCount">
            <div class="empty-inline">
              <VIcon name="layers" :size="28" class="muted" />
              <p class="empty-title">{{ search || activeFilterCount ? 'No matching cohorts' : 'No cohorts yet' }}</p>
              <p class="empty-sub">
                {{ search || activeFilterCount ? 'Try adjusting your search or filters.' : 'Create a cohort to begin standing it up.' }}
              </p>
              <VButton v-if="!search && !activeFilterCount" variant="primary" icon="plus" @click="openCreate">New cohort</VButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div v-if="!store.loading && total > 0" class="pager">
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
        <p class="pop-title">Filter by state</p>
        <button v-if="activeFilterCount > 0" class="pop-clear" @click="clearFilter">Clear</button>
      </div>
      <label v-for="opt in STATE_OPTIONS" :key="opt.key" class="pop-row">
        <input type="checkbox" :checked="stateFilter.has(opt.key)" @change="toggleState(opt.key)" />
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
    <div v-if="activeKebabCohort && kebabPos" class="pop pop-actions" :style="{ top: `${kebabPos.top}px`, left: `${kebabPos.left}px` }" @click.stop>
      <button class="pop-item" @click="openFromKebab(activeKebabCohort)">
        <VIcon name="eye" :size="15" />
        {{ activeKebabCohort.lifecycleState === 'STOOD_UP' ? 'View details' : 'Open stand-up' }}
      </button>
      <button v-if="activeKebabCohort.sharepointFolderUrl" class="pop-item" @click="copyFolderLink(activeKebabCohort)">
        <VIcon name="copy" :size="15" />
        Copy folder link
      </button>
    </div>
  </Teleport>

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

/* ── Table typography (neutral Inter face, matching the design system) ── */
.cohorts-tbl {
  width: 100%;
}
.cohorts-tbl thead th {
  background: var(--table-head-bg);
  color: var(--navy);
  text-transform: none;
  letter-spacing: 0;
  font-size: 13px;
  font-weight: 600;
  padding: 12px 16px;
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
  box-shadow: 0 0 0 3px rgba(8, 40, 59, 0.18);
}
.pg-arrow:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
/* Navy accents (replaces orange) for this page's controls */
.tb-left .search:focus-within {
  border-color: var(--navy);
  box-shadow: 0 0 0 3px rgba(8, 40, 59, 0.18);
}
.pop-actions {
  padding: 4px;
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
  color: var(--text);
  margin: 0;
}
.empty-sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 8px;
}

/* Popovers (teleported) */
.pop {
  position: fixed;
  z-index: 1000;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-pop);
  min-width: 200px;
  overflow: hidden;
  padding: 10px 8px 8px;
}
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
