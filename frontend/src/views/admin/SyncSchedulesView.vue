<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VSortIcon from '@/components/base/VSortIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import VToggle from '@/components/base/VToggle.vue'
import { useSyncSchedulesStore } from '@/stores/syncSchedules'
import { useCohortsStore } from '@/stores/cohorts'
import { useToastStore } from '@/stores/toast'
import { toErrorMessage } from '@/utils/errors'
import type { DayOfWeekName, ScheduleFrequency, SyncSchedulePayload, SyncScheduleResponse } from '@/types/syncSchedule.types'

const store = useSyncSchedulesStore()
const cohorts = useCohortsStore()
const toast = useToastStore()

const loading = computed(() => store.loading || cohorts.loading)

onMounted(() => {
  store.fetchList()
  cohorts.fetchList()
  window.addEventListener('click', closeMenus)
})
onUnmounted(() => window.removeEventListener('click', closeMenus))

const FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
]

const DAYS: DayOfWeekName[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

// Common offerings only — an unrecognized value from the server (e.g. an
// engagement-specific zone) still round-trips correctly on save even if it
// doesn't match one of these options for display.
const TIMEZONES = ['GMT', 'UTC', 'Africa/Accra', 'Europe/London']

function dayLabel(d: string): string {
  return d.charAt(0) + d.slice(1).toLowerCase()
}

function cohortName(cohortId: string | null): string {
  if (cohortId === null) return 'All eligible cohorts'
  return cohorts.list.find((c) => c.id === cohortId)?.name ?? cohortId
}

function frequencyLabel(s: SyncScheduleResponse): string {
  return s.frequency === 'WEEKLY' ? `Weekly · ${dayLabel(s.dayOfWeek ?? '')}` : 'Daily'
}

function timeLabel(s: SyncScheduleResponse): string {
  return `${s.timeOfDay.slice(0, 5)} ${s.timezone}`
}

// ── Search + filter (by status) ───────────────────────────────────────────────
type StatusKey = 'ENABLED' | 'PAUSED'
const STATUS_OPTIONS: { key: StatusKey; label: string }[] = [
  { key: 'ENABLED', label: 'Enabled' },
  { key: 'PAUSED', label: 'Paused' },
]
const search = ref('')
const statusFilter = ref<Set<StatusKey>>(new Set())
const activeFilterCount = computed(() => statusFilter.value.size)

function toggleStatus(key: StatusKey) {
  const next = new Set(statusFilter.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  statusFilter.value = next
}
function clearFilter() {
  statusFilter.value = new Set()
}

// ── Column visibility ──────────────────────────────────────────────────────────
const cols = ref({ cohort: true, frequency: true, time: true, status: true })
const COL_LABELS: { key: keyof typeof cols.value; label: string }[] = [
  { key: 'cohort', label: 'Cohort' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'time', label: 'Time' },
  { key: 'status', label: 'Status' },
]
const colCount = computed(() => 1 + Object.values(cols.value).filter(Boolean).length + 1) // name + toggled + actions

// ── Popovers (filter + columns) ────────────────────────────────────────────────
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

// ── Row actions (kebab) ──────────────────────────────────────────────────────────
const activeKebabId = ref<string | null>(null)
const kebabPos = ref<{ top: number; left: number } | null>(null)
const activeKebab = computed(() => store.list.find((s) => s.id === activeKebabId.value) ?? null)
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

// ── Row actions ──────────────────────────────────────────────────────────────
function payloadFromRow(s: SyncScheduleResponse): SyncSchedulePayload {
  return {
    name: s.name,
    cohortId: s.cohortId ?? undefined,
    frequency: s.frequency,
    timeOfDay: s.timeOfDay,
    dayOfWeek: s.dayOfWeek ?? undefined,
    timezone: s.timezone,
    enabled: s.enabled,
  }
}

async function toggleEnabled(s: SyncScheduleResponse) {
  activeKebabId.value = null
  try {
    await store.update(s.id, { ...payloadFromRow(s), enabled: !s.enabled })
    toast.show({ tone: 'success', title: s.enabled ? 'Sync schedule paused' : 'Sync schedule enabled' })
  } catch {
    toast.show({ tone: 'warning', title: 'Could not update sync schedule', body: store.actionError ?? 'Please try again.' })
  }
}

async function onDelete(s: SyncScheduleResponse) {
  activeKebabId.value = null
  if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return
  try {
    await store.remove(s.id)
    toast.show({ tone: 'success', title: 'Sync schedule deleted' })
  } catch {
    toast.show({ tone: 'warning', title: 'Could not delete sync schedule', body: store.actionError ?? 'Please try again.' })
  }
}

// ── Sorting ────────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'cohort' | 'frequency' | 'time' | 'status'
const sortKey = ref<SortKey>('name')
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}
function sortValue(s: SyncScheduleResponse, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return s.name.toLowerCase()
    case 'cohort':
      return cohortName(s.cohortId).toLowerCase()
    case 'frequency':
      return `${s.frequency}${s.dayOfWeek ?? ''}`
    case 'time':
      return s.timeOfDay
    case 'status':
      return s.enabled ? 1 : 0
  }
}

// ── Derived: filter → sort → paginate ────────────────────────────────────────
const filtered = computed(() =>
  store.list.filter((s) => {
    const q = search.value.trim().toLowerCase()
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || cohortName(s.cohortId).toLowerCase().includes(q)
    const matchesStatus = statusFilter.value.size === 0 || statusFilter.value.has(s.enabled ? 'ENABLED' : 'PAUSED')
    return matchesSearch && matchesStatus
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
const pageItems = computed<(number | '…')[]>(() => {
  const tp = totalPages.value
  const cur = safePage.value
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
})
function goToPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
}
watch([search, pageSize, statusFilter], () => {
  currentPage.value = 1
})

// ── Create / edit drawer ─────────────────────────────────────────────────────
const showDrawer = ref(false)
const submitting = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')
const form = ref({
  name: '',
  cohortId: '',
  frequency: 'WEEKLY' as ScheduleFrequency,
  dayOfWeek: 'MONDAY' as DayOfWeekName,
  timeOfDay: '08:00',
  timezone: '',
  enabled: true,
})

const drawerTitle = computed(() => (editingId.value ? 'Edit sync schedule' : 'New sync schedule'))

function openCreate() {
  editingId.value = null
  form.value = { name: '', cohortId: '', frequency: 'WEEKLY', dayOfWeek: 'MONDAY', timeOfDay: '08:00', timezone: '', enabled: true }
  formError.value = ''
  showDrawer.value = true
}

function openEdit(s: SyncScheduleResponse) {
  activeKebabId.value = null
  editingId.value = s.id
  form.value = {
    name: s.name,
    cohortId: s.cohortId ?? '',
    frequency: s.frequency,
    dayOfWeek: s.dayOfWeek ?? 'MONDAY',
    timeOfDay: s.timeOfDay.slice(0, 5),
    timezone: s.timezone,
    enabled: s.enabled,
  }
  formError.value = ''
  showDrawer.value = true
}

function closeDrawer() {
  showDrawer.value = false
}

async function submit() {
  formError.value = ''
  if (!form.value.name.trim() || !form.value.timeOfDay) {
    formError.value = 'Name and time of day are required.'
    return
  }
  if (form.value.frequency === 'WEEKLY' && !form.value.dayOfWeek) {
    formError.value = 'Day of week is required for a weekly schedule.'
    return
  }

  const payload: SyncSchedulePayload = {
    name: form.value.name.trim(),
    cohortId: form.value.cohortId || undefined,
    frequency: form.value.frequency,
    timeOfDay: form.value.timeOfDay,
    dayOfWeek: form.value.frequency === 'WEEKLY' ? form.value.dayOfWeek : undefined,
    timezone: form.value.timezone || undefined,
    enabled: form.value.enabled,
  }

  submitting.value = true
  try {
    if (editingId.value) {
      await store.update(editingId.value, payload)
      toast.show({ tone: 'success', title: 'Sync schedule updated' })
    } else {
      await store.create(payload)
      toast.show({ tone: 'success', title: 'Sync schedule created' })
    }
    showDrawer.value = false
  } catch (e) {
    formError.value = toErrorMessage(e, 'Failed to save sync schedule. Please try again.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1 class="page-title">Sync schedules</h1>
      <p class="page-sub">Recurring schedules that trigger score-sheet sync runs, per cohort or across all eligible cohorts.</p>
    </div>
  </div>

  <!-- Error state -->
  <div v-if="store.error && !store.loading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load sync schedules</p>
    <p class="load-error-sub">{{ store.error }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="store.fetchList()">Try again</VButton>
  </div>

  <div v-else class="tbl-wrap">
    <!-- Toolbar -->
    <div class="tbl-toolbar">
      <div class="tb-left">
        <div class="search">
          <VIcon name="search" :size="16" style="color: var(--text-muted)" />
          <input v-model="search" type="search" placeholder="Search schedules" aria-label="Search schedules" />
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
        <VButton size="sm" variant="primary" icon="plus" @click="openCreate">New schedule</VButton>
      </div>
    </div>

    <table class="tbl schedules-tbl">
      <thead>
        <tr>
          <th>
            <button class="th-sort" @click="toggleSort('name')">
              Name
              <VSortIcon :active="sortKey === 'name'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.cohort">
            <button class="th-sort" @click="toggleSort('cohort')">
              Cohort
              <VSortIcon :active="sortKey === 'cohort'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.frequency">
            <button class="th-sort" @click="toggleSort('frequency')">
              Frequency
              <VSortIcon :active="sortKey === 'frequency'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.time">
            <button class="th-sort" @click="toggleSort('time')">
              Time
              <VSortIcon :active="sortKey === 'time'" :dir="sortDir" />
            </button>
          </th>
          <th v-if="cols.status">
            <button class="th-sort" @click="toggleSort('status')">
              Status
              <VSortIcon :active="sortKey === 'status'" :dir="sortDir" />
            </button>
          </th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>

      <tbody v-if="loading">
        <tr v-for="i in 4" :key="i" class="skel-row">
          <td><span class="skel" style="width: 55%" /></td>
          <td v-if="cols.cohort"><span class="skel" style="width: 65%" /></td>
          <td v-if="cols.frequency"><span class="skel" style="width: 60%" /></td>
          <td v-if="cols.time"><span class="skel mono" style="width: 70px" /></td>
          <td v-if="cols.status"><span class="skel" style="width: 74px; border-radius: 999px" /></td>
          <td class="col-actions"><span class="skel" style="width: 18px; display: inline-block" /></td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-for="s in paged" :key="s.id" class="row-click" @click="openEdit(s)">
          <td class="name-cell">{{ s.name }}</td>
          <td v-if="cols.cohort">
            <VPill v-if="s.cohortId === null" tone="info">All eligible cohorts</VPill>
            <span v-else class="muted">{{ cohortName(s.cohortId) }}</span>
          </td>
          <td v-if="cols.frequency" class="muted">{{ frequencyLabel(s) }}</td>
          <td v-if="cols.time" class="mono muted">{{ timeLabel(s) }}</td>
          <td v-if="cols.status">
            <VPill v-if="s.enabled" tone="success">Enabled</VPill>
            <span v-else class="pill pill-muted">Paused</span>
          </td>
          <td class="col-actions">
            <button class="kebab" aria-label="Row actions" @click.stop="toggleKebab($event, s.id)">
              <VIcon name="more-vertical" :size="18" />
            </button>
          </td>
        </tr>

        <tr v-if="paged.length === 0">
          <td :colspan="colCount">
            <div class="empty-inline">
              <VIcon name="calendar" :size="28" class="muted" />
              <p class="empty-title">{{ search || activeFilterCount ? 'No matching schedules' : 'No sync schedules yet' }}</p>
              <p class="empty-sub">
                {{ search || activeFilterCount ? 'Try adjusting your search or filters.' : 'Create a schedule to automate grading sheet ingestion.' }}
              </p>
              <VButton v-if="!search && !activeFilterCount" variant="primary" icon="plus" @click="openCreate">New schedule</VButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div v-if="!loading && total > 0" class="pager">
      <span class="pager-count"><span class="pg-strong">{{ total }}</span> Entries</span>
      <div class="pager-right">
        <div class="pgsize">
          <select v-model.number="pageSize" aria-label="Rows per page">
            <option v-for="n in [10, 15, 20, 25, 30, 35, 40]" :key="n" :value="n">{{ n }} per page</option>
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
        <p class="pop-title">Filter by status</p>
        <button v-if="activeFilterCount > 0" class="pop-clear" @click="clearFilter">Clear</button>
      </div>
      <label v-for="opt in STATUS_OPTIONS" :key="opt.key" class="pop-row">
        <input type="checkbox" :checked="statusFilter.has(opt.key)" @change="toggleStatus(opt.key)" />
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
    <div v-if="activeKebab && kebabPos" class="pop pop-actions" :style="{ top: `${kebabPos.top}px`, left: `${kebabPos.left}px` }" @click.stop>
      <button class="pop-item" @click="openEdit(activeKebab)">
        <VIcon name="pencil" :size="15" />
        Edit schedule
      </button>
      <button class="pop-item" @click="toggleEnabled(activeKebab)">
        <VIcon :name="activeKebab.enabled ? 'minus-circle' : 'play'" :size="15" />
        {{ activeKebab.enabled ? 'Pause schedule' : 'Enable schedule' }}
      </button>
      <button class="pop-item danger" @click="onDelete(activeKebab)">
        <VIcon name="trash-2" :size="15" />
        Delete schedule
      </button>
    </div>
  </Teleport>

  <!-- Create / edit drawer -->
  <VDrawer
    :open="showDrawer"
    :title="drawerTitle"
    subtitle="Omit a cohort to run the same batch as a manual sync-all."
    :error="formError || undefined"
    @close="closeDrawer"
  >
    <label class="ff">
      <span class="ff-label">Name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="form.name" placeholder="e.g. Nightly sync — all cohorts" />
      </span>
    </label>

    <label class="ff">
      <span class="ff-label">Cohort</span>
      <span class="ff-input">
        <select v-model="form.cohortId">
          <option value="">All eligible cohorts</option>
          <option v-for="c in cohorts.list" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </span>
    </label>

    <div class="ff-row">
      <label class="ff">
        <span class="ff-label">Frequency <span style="color: var(--danger)">*</span></span>
        <span class="ff-input">
          <select v-model="form.frequency">
            <option v-for="f in FREQUENCIES" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </span>
      </label>
      <label v-if="form.frequency === 'WEEKLY'" class="ff">
        <span class="ff-label">Day of week <span style="color: var(--danger)">*</span></span>
        <span class="ff-input">
          <select v-model="form.dayOfWeek">
            <option v-for="d in DAYS" :key="d" :value="d">{{ dayLabel(d) }}</option>
          </select>
        </span>
      </label>
    </div>

    <div class="ff-row">
      <label class="ff">
        <span class="ff-label">Time of day <span style="color: var(--danger)">*</span></span>
        <span class="ff-input">
          <input v-model="form.timeOfDay" type="time" class="mono" />
        </span>
      </label>
      <label class="ff">
        <span class="ff-label">Timezone</span>
        <span class="ff-input">
          <select v-model="form.timezone">
            <option value="">Use default</option>
            <option v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz }}</option>
          </select>
        </span>
      </label>
    </div>

    <div class="ff">
      <span class="ff-label">Enabled</span>
      <VToggle v-model="form.enabled" active-color="success" />
    </div>

    <template #footer>
      <VButton variant="ghost" @click="closeDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submit">
        {{ submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create schedule' }}
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
.muted {
  color: var(--text-secondary);
}
.name-cell {
  font-weight: 600;
}
.col-actions {
  width: 90px;
  text-align: right;
}
.row-click {
  cursor: pointer;
}

/* Neutral "Paused" pill (VPill has no neutral tone) */
.pill-muted {
  background: var(--bg-sunken);
  color: var(--text-secondary);
}

/* Danger action in the kebab menu */
.pop-item.danger {
  color: var(--danger);
}
.pop-item.danger:hover {
  background: var(--danger-bg);
}
.pop-item.danger svg {
  color: var(--danger);
}

.pg-arrow:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ff-input select {
  border: none;
  outline: none;
  flex: 1;
  height: 100%;
  font-family: inherit;
  font-size: 15px;
  color: var(--text);
  background: transparent;
  min-width: 0;
}
</style>
