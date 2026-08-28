<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VSortIcon from '@/components/base/VSortIcon.vue'
import VTablePager from '@/components/base/VTablePager.vue'
import VPopover from '@/components/base/VPopover.vue'
import VEmptyState from '@/components/base/VEmptyState.vue'
import { useToastStore } from '@/stores/toast'
import { usePageTitle } from '@/composables/usePageTitle'
import { useQueryParam } from '@/composables/useQueryParam'
import { loadPageSize, savePageSize } from '@/utils/uiPrefs'
import { PAGE_SIZE_OPTIONS } from '@/utils/pagination'
import { fmtDate } from '@/utils/datetime'
import { getAuditLog, getUploadReport } from '@/services/admin.service'
import type { AuditEntry, ValidationReport } from '@/types/report.types'

usePageTitle('Audit log')

const toast = useToastStore()

const view = ref<'list' | 'report'>('list')
const entries = ref<AuditEntry[]>([])
const report = ref<ValidationReport | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadSlow = ref(false)
const LOAD_TIMEOUT_MS = 8000
const reportLoading = ref(false)
const reportError = ref<string | null>(null)
const search = ref('')

// ── Filters (date range / instructor / status) ──────────────────────────────
const dateFrom = ref('')
const dateTo = ref('')
const instructorFilter = ref('')
const statusFilter = ref<AuditEntry['statusLabel'] | ''>('')
const STATUS_FILTER_OPTIONS: AuditEntry['statusLabel'][] = ['Completed', 'Partial', 'Failed']
const hasActiveFilters = computed(() => !!(dateFrom.value || dateTo.value || instructorFilter.value || statusFilter.value))

function resetFilters() {
  dateFrom.value = ''
  dateTo.value = ''
  instructorFilter.value = ''
  statusFilter.value = ''
  closeFilterPopover()
}

const dateRangeLabel = computed(() => {
  if (!dateFrom.value && !dateTo.value) return 'All dates'
  return `${dateFrom.value ? fmtDate(dateFrom.value) : '…'} – ${dateTo.value ? fmtDate(dateTo.value) : '…'}`
})

/**
 * `uploadedAt` is a display-formatted string (mock data, e.g. "Oct 24, 09:41 AM") rather than an
 * ISO timestamp, so it isn't reliably parseable — skip date-range filtering for any entry `Date`
 * can't parse instead of hiding it outright.
 */
function withinDateRange(uploadedAt: string): boolean {
  if (!dateFrom.value && !dateTo.value) return true
  const t = new Date(uploadedAt).getTime()
  if (Number.isNaN(t)) return true
  if (dateFrom.value && t < new Date(`${dateFrom.value}T00:00:00`).getTime()) return false
  if (dateTo.value && t > new Date(`${dateTo.value}T23:59:59`).getTime()) return false
  return true
}

async function loadData() {
  isLoading.value = true
  loadError.value = null
  loadSlow.value = false
  const slowTimer = setTimeout(() => { loadSlow.value = true }, LOAD_TIMEOUT_MS)
  try {
    entries.value = await getAuditLog()
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    loadError.value = msg || 'Failed to load audit log. Check your connection and try again.'
  } finally {
    clearTimeout(slowTimer)
    isLoading.value = false
    loadSlow.value = false
  }
}

onMounted(loadData)

const instructorOptions = computed(() => [...new Set(entries.value.map((e) => e.instructor))].sort((a, b) => a.localeCompare(b)))

const filteredEntries = computed(() => {
  const q = search.value.trim().toLowerCase()
  return entries.value.filter((e) => {
    if (q && !(e.id.toLowerCase().includes(q) || e.file.toLowerCase().includes(q))) return false
    if (instructorFilter.value && e.instructor !== instructorFilter.value) return false
    if (statusFilter.value && e.statusLabel !== statusFilter.value) return false
    if (!withinDateRange(e.uploadedAt)) return false
    return true
  })
})

// ── Sorting ──────────────────────────────────────────────────────────────────
type SortKey = 'id' | 'instructor' | 'file' | 'uploadedAt' | 'totalRows' | 'accepted' | 'rejected' | 'status'
const SORT_KEYS: SortKey[] = ['id', 'instructor', 'file', 'uploadedAt', 'totalRows', 'accepted', 'rejected', 'status']
const sortKey = ref<SortKey>('uploadedAt')
const sortDir = ref<'asc' | 'desc'>('desc')

// Table state (search/filters/sort/page) lives in the URL so the filtered/sorted/paged view is a
// shareable link — `currentPage` is declared ahead of the Pagination section below because
// `useQueryParam` binds to it immediately, not lazily.
const currentPage = ref(1)
function parseStr(raw: string | undefined): string {
  return raw ?? ''
}
function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}
function parseSortKey(raw: string | undefined): SortKey {
  return SORT_KEYS.includes(raw as SortKey) ? (raw as SortKey) : 'uploadedAt'
}
function parseSortDir(raw: string | undefined): 'asc' | 'desc' {
  return raw === 'asc' ? 'asc' : 'desc'
}
function parseStatus(raw: string | undefined): AuditEntry['statusLabel'] | '' {
  return (STATUS_FILTER_OPTIONS as string[]).includes(raw ?? '') ? (raw as AuditEntry['statusLabel']) : ''
}
useQueryParam({ key: 'q', target: search, parse: parseStr, encode: (v) => v.trim() || null })
useQueryParam({ key: 'page', target: currentPage, parse: parsePage, encode: (v) => (v > 1 ? String(v) : null) })
useQueryParam({ key: 'sort', target: sortKey, parse: parseSortKey, encode: (v) => (v !== 'uploadedAt' ? v : null) })
useQueryParam({ key: 'dir', target: sortDir, parse: parseSortDir, encode: (v) => (v !== 'desc' ? v : null) })
useQueryParam({ key: 'from', target: dateFrom, parse: parseStr, encode: (v) => v || null })
useQueryParam({ key: 'to', target: dateTo, parse: parseStr, encode: (v) => v || null })
useQueryParam({ key: 'instructor', target: instructorFilter, parse: parseStr, encode: (v) => v || null })
useQueryParam({ key: 'status', target: statusFilter, parse: parseStatus, encode: (v) => v || null })

function toggleSort(k: SortKey) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = k
    sortDir.value = 'asc'
  }
}
function sortVal(e: AuditEntry, k: SortKey): string | number {
  switch (k) {
    case 'id': return e.id.toLowerCase()
    case 'instructor': return e.instructor.toLowerCase()
    case 'file': return e.file.toLowerCase()
    case 'uploadedAt': return e.uploadedAt
    case 'totalRows': return e.totalRows
    case 'accepted': return e.accepted
    case 'rejected': return e.rejected
    case 'status': return e.statusLabel
  }
}
const sortedEntries = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filteredEntries.value].sort((a, b) => {
    const av = sortVal(a, sortKey.value)
    const bv = sortVal(b, sortKey.value)
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return cmp * dir
  })
})

// ── Pagination ───────────────────────────────────────────────────────────────
const PAGESIZE_KEY = 'validata.reports.pageSize'
const pageSize = ref(loadPageSize(PAGESIZE_KEY, 10, PAGE_SIZE_OPTIONS))
watch(pageSize, (v) => savePageSize(PAGESIZE_KEY, v))
const total = computed(() => sortedEntries.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const safePage = computed(() => Math.min(currentPage.value, totalPages.value))
const pagedEntries = computed(() => {
  const start = (safePage.value - 1) * pageSize.value
  return sortedEntries.value.slice(start, start + pageSize.value)
})
function goToPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  currentPage.value = p
}
watch([search, pageSize, dateFrom, dateTo, instructorFilter, statusFilter], () => {
  currentPage.value = 1
})

// ── Manage columns ─────────────────────────────────────────────────────────
const cols = ref({ instructor: true, file: true, uploadedAt: true, totalRows: true, accepted: true, rejected: true, status: true })
const COL_LABELS: { key: keyof typeof cols.value; label: string }[] = [
  { key: 'instructor', label: 'Instructor' },
  { key: 'file', label: 'Filename' },
  { key: 'uploadedAt', label: 'Uploaded at' },
  { key: 'totalRows', label: 'Total rows' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'status', label: 'Status' },
]
const colCount = computed(() => 1 + Object.values(cols.value).filter(Boolean).length + 1)
const showColMenu = ref(false)
const colMenuAnchor = ref<HTMLElement | null>(null)
function toggleColMenu(event: MouseEvent) {
  closeFilterPopover()
  colMenuAnchor.value = event.currentTarget as HTMLElement
  showColMenu.value = !showColMenu.value
}
function closeColMenu() {
  showColMenu.value = false
  closeFilterPopover()
}

// ── Filter popovers (Date range / Instructor / Status) ──────────────────────
type FilterPopoverKey = 'date' | 'instructor' | 'status'
const activeFilterPopover = ref<FilterPopoverKey | null>(null)
const filterPopoverAnchor = ref<HTMLElement | null>(null)
function toggleFilterPopover(key: FilterPopoverKey, event: MouseEvent) {
  showColMenu.value = false
  if (activeFilterPopover.value === key) {
    closeFilterPopover()
    return
  }
  filterPopoverAnchor.value = event.currentTarget as HTMLElement
  activeFilterPopover.value = key
}
function closeFilterPopover() {
  activeFilterPopover.value = null
}

// ── Export ──────────────────────────────────────────────────────────────────
function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function exportCsv() {
  closeColMenu()
  const rows = sortedEntries.value
  if (!rows.length) {
    toast.show({ tone: 'info', title: 'Nothing to export', body: 'No uploads match the current view.' })
    return
  }
  const header = ['Upload ID', 'Instructor', 'Filename', 'Uploaded at', 'Total rows', 'Accepted', 'Rejected', 'Status']
  const body = rows.map((e) =>
    [e.id, e.instructor, e.file, e.uploadedAt, e.totalRows, e.accepted, e.rejected, e.statusLabel].map(csvCell).join(','),
  )
  const csv = [header.map(csvCell).join(','), ...body].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'audit-log.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.show({ tone: 'success', title: 'Export ready', body: `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} exported to CSV.` })
}

function statusDotColor(status: AuditEntry['status']): string {
  if (status === 'success') return 'var(--success)'
  if (status === 'warning') return 'var(--warning)'
  return 'var(--danger)'
}

function chipStyle(value: number, tone: 'acc' | 'rej'): string {
  if (value === 0) return 'background: #EFEEE9; color: var(--text-secondary)'
  return tone === 'acc'
    ? 'background: var(--success-bg); color: var(--success)'
    : 'background: var(--danger-bg); color: var(--danger)'
}

async function openReport(entry: AuditEntry) {
  view.value = 'report'
  reportLoading.value = true
  reportError.value = null
  try {
    report.value = await getUploadReport(entry.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    reportError.value = msg || 'Failed to load the validation report. Please try again.'
  } finally {
    reportLoading.value = false
  }
}

function backToList() {
  view.value = 'list'
  report.value = null
  reportError.value = null
}
</script>

<template>
  <!-- ── Audit log list ──────────────────────────────────────────────────── -->
  <template v-if="view === 'list'">
    <div class="page-head">
      <h1 class="page-title">Audit log</h1>
    </div>

    <div class="card card-pad filterbar" style="margin-bottom: 20px">
      <div class="selectf">
        <span class="selectf-label">Date Range</span>
        <button type="button" class="selectf-btn" @click="toggleFilterPopover('date', $event)">
          <span>{{ dateRangeLabel }}</span>
          <VIcon name="chevron-down" :size="16" style="color: var(--text-secondary)" />
        </button>
      </div>
      <div class="selectf">
        <span class="selectf-label">Instructor</span>
        <button type="button" class="selectf-btn" @click="toggleFilterPopover('instructor', $event)">
          <span>{{ instructorFilter || 'All Instructors' }}</span>
          <VIcon name="chevron-down" :size="16" style="color: var(--text-secondary)" />
        </button>
      </div>
      <div class="selectf">
        <span class="selectf-label">Status</span>
        <button type="button" class="selectf-btn" @click="toggleFilterPopover('status', $event)">
          <span>{{ statusFilter || 'All' }}</span>
          <VIcon name="chevron-down" :size="16" style="color: var(--text-secondary)" />
        </button>
      </div>
      <div class="selectf" style="flex: 1">
        <span class="selectf-label">Search</span>
        <div class="search">
          <VIcon name="search" :size="17" style="color: var(--text-secondary)" />
          <input v-model="search" placeholder="Search by ID or Filename" />
        </div>
      </div>
      <button v-if="hasActiveFilters" type="button" class="link" style="display: inline-flex; align-items: center; gap: 4px; height: 40px" @click="resetFilters">
        <VIcon name="x" :size="14" />Reset filters
      </button>
    </div>

    <!-- Slow-connection warning -->
    <div v-if="loadSlow && isLoading" class="load-slow-banner">
      <VIcon name="clock" :size="15" />
      This is taking longer than expected…
    </div>

    <!-- Error state -->
    <div v-else-if="loadError && !isLoading" class="load-error-state">
      <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
      <p class="load-error-title">Could not load audit log</p>
      <p class="load-error-sub">{{ loadError }}</p>
      <VButton variant="ghost" icon="rotate-ccw" @click="loadData">Try again</VButton>
    </div>

    <div v-else class="tbl-wrap">
      <!-- Toolbar -->
      <div class="tbl-toolbar">
        <span class="tb-hint">{{ total }} upload{{ total === 1 ? '' : 's' }}</span>
        <div class="tb-actions">
          <VButton size="sm" variant="ghost" icon="columns-3" @click="toggleColMenu">Manage columns</VButton>
          <VButton size="sm" variant="primary" icon="download" @click="exportCsv">Export</VButton>
        </div>
      </div>

      <table class="tbl">
        <thead>
          <tr>
            <th>
              <button class="th-sort" @click="toggleSort('id')">Upload ID
                <VSortIcon :active="sortKey === 'id'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.instructor">
              <button class="th-sort" @click="toggleSort('instructor')">Instructor
                <VSortIcon :active="sortKey === 'instructor'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.file">
              <button class="th-sort" @click="toggleSort('file')">Filename
                <VSortIcon :active="sortKey === 'file'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.uploadedAt">
              <button class="th-sort" @click="toggleSort('uploadedAt')">Uploaded at
                <VSortIcon :active="sortKey === 'uploadedAt'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.totalRows" style="text-align: right">
              <button class="th-sort" @click="toggleSort('totalRows')">Total rows
                <VSortIcon :active="sortKey === 'totalRows'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.accepted" style="text-align: center">
              <button class="th-sort" @click="toggleSort('accepted')">Accepted
                <VSortIcon :active="sortKey === 'accepted'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.rejected" style="text-align: center">
              <button class="th-sort" @click="toggleSort('rejected')">Rejected
                <VSortIcon :active="sortKey === 'rejected'" :dir="sortDir" />
              </button>
            </th>
            <th v-if="cols.status">
              <button class="th-sort" @click="toggleSort('status')">Status
                <VSortIcon :active="sortKey === 'status'" :dir="sortDir" />
              </button>
            </th>
            <th style="text-align: right">Actions</th>
          </tr>
        </thead>
        <tbody v-if="isLoading">
          <tr v-for="i in 8" :key="i" class="skel-row">
            <td><span class="skel mono" style="width: 90px" /></td>
            <td v-if="cols.instructor"><span class="skel" style="width: 55%" /></td>
            <td v-if="cols.file"><span class="skel mono" style="width: 70%" /></td>
            <td v-if="cols.uploadedAt"><span class="skel" style="width: 80px" /></td>
            <td v-if="cols.totalRows" style="text-align: right"><span class="skel mono" style="width: 40px; display: inline-block" /></td>
            <td v-if="cols.accepted" style="text-align: center"><span class="skel" style="width: 40px; border-radius: 999px; display: inline-block" /></td>
            <td v-if="cols.rejected" style="text-align: center"><span class="skel" style="width: 40px; border-radius: 999px; display: inline-block" /></td>
            <td v-if="cols.status"><span class="skel" style="width: 70px; border-radius: 999px" /></td>
            <td style="text-align: right"><span class="skel" style="width: 48px; display: inline-block" /></td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-if="!pagedEntries.length">
            <td :colspan="colCount" style="padding: 32px 0">
              <VEmptyState
                icon="inbox"
                title="No uploads found"
                :description="hasActiveFilters ? 'Try adjusting your filters or search.' : 'Uploads will appear here once instructors submit files.'"
              />
            </td>
          </tr>
          <tr v-for="entry in pagedEntries" :key="entry.id">
            <td class="mono" style="color: var(--text-secondary)">{{ entry.id }}</td>
            <td v-if="cols.instructor" style="font-weight: 500">{{ entry.instructor }}</td>
            <td v-if="cols.file" class="mono">{{ entry.file }}</td>
            <td v-if="cols.uploadedAt" style="color: var(--text-secondary)">{{ entry.uploadedAt }}</td>
            <td v-if="cols.totalRows" class="mono" style="text-align: right">{{ entry.totalRows.toLocaleString() }}</td>
            <td v-if="cols.accepted" style="text-align: center">
              <span class="count-chip" :style="chipStyle(entry.accepted, 'acc')">
                {{ entry.accepted.toLocaleString() }}
              </span>
            </td>
            <td v-if="cols.rejected" style="text-align: center">
              <span class="count-chip" :style="chipStyle(entry.rejected, 'rej')">
                {{ entry.rejected.toLocaleString() }}
              </span>
            </td>
            <td v-if="cols.status">
              <span class="pill-dot">
                <span class="dot" :style="{ background: statusDotColor(entry.status) }" />
                {{ entry.statusLabel }}
              </span>
            </td>
            <td style="text-align: right">
              <button class="link" @click="openReport(entry)">Details</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <VTablePager
        v-if="!isLoading && total > 0"
        :total="total"
        :page="safePage"
        :page-size="pageSize"
        @update:page="goToPage"
        @update:page-size="pageSize = $event"
      />
    </div>

    <!-- Manage columns popover -->
    <VPopover :open="showColMenu" :anchor="colMenuAnchor" @close="showColMenu = false">
      <p class="pop-title">Manage columns</p>
      <label v-for="c in COL_LABELS" :key="c.key" class="pop-row">
        <input type="checkbox" v-model="cols[c.key]" />
        {{ c.label }}
      </label>
    </VPopover>

    <!-- Date range filter popover -->
    <VPopover :open="activeFilterPopover === 'date'" :anchor="filterPopoverAnchor" @close="closeFilterPopover">
      <div class="pop-head">
        <p class="pop-title">Date range</p>
        <button v-if="dateFrom || dateTo" class="pop-clear" @click="dateFrom = ''; dateTo = ''">Clear</button>
      </div>
      <label class="pop-row" style="flex-direction: column; align-items: stretch; gap: 4px">
        <span style="font-size: 12px; color: var(--text-secondary)">From</span>
        <input
          v-model="dateFrom"
          type="date"
          style="height: 34px; border: 1px solid var(--border); border-radius: var(--r-sm); padding: 0 8px; font: inherit"
        />
      </label>
      <label class="pop-row" style="flex-direction: column; align-items: stretch; gap: 4px">
        <span style="font-size: 12px; color: var(--text-secondary)">To</span>
        <input
          v-model="dateTo"
          type="date"
          style="height: 34px; border: 1px solid var(--border); border-radius: var(--r-sm); padding: 0 8px; font: inherit"
        />
      </label>
    </VPopover>

    <!-- Instructor filter popover -->
    <VPopover :open="activeFilterPopover === 'instructor'" :anchor="filterPopoverAnchor" @close="closeFilterPopover">
      <div class="pop-head">
        <p class="pop-title">Instructor</p>
        <button v-if="instructorFilter" class="pop-clear" @click="instructorFilter = ''; closeFilterPopover()">Clear</button>
      </div>
      <button
        v-for="name in instructorOptions"
        :key="name"
        type="button"
        class="pop-item"
        :style="instructorFilter === name ? 'background: var(--bg); font-weight: 600' : ''"
        @click="instructorFilter = name; closeFilterPopover()"
      >
        {{ name }}
      </button>
    </VPopover>

    <!-- Status filter popover -->
    <VPopover :open="activeFilterPopover === 'status'" :anchor="filterPopoverAnchor" @close="closeFilterPopover">
      <div class="pop-head">
        <p class="pop-title">Status</p>
        <button v-if="statusFilter" class="pop-clear" @click="statusFilter = ''; closeFilterPopover()">Clear</button>
      </div>
      <button
        v-for="s in STATUS_FILTER_OPTIONS"
        :key="s"
        type="button"
        class="pop-item"
        :style="statusFilter === s ? 'background: var(--bg); font-weight: 600' : ''"
        @click="statusFilter = s; closeFilterPopover()"
      >
        {{ s }}
      </button>
    </VPopover>
  </template>

  <!-- ── Validation report detail ───────────────────────────────────────── -->
  <template v-else-if="view === 'report'">
    <template v-if="reportLoading">
      <div class="report-head card card-pad">
        <div style="width: 100%">
          <span class="skel" style="width: 80px; display: block; margin-bottom: 10px" />
          <span class="skel" style="width: 200px; height: 24px; display: block; margin-bottom: 12px" />
          <span class="skel" style="width: 280px; display: block" />
        </div>
      </div>
      <div class="sum-row">
        <div v-for="i in 3" :key="i" class="sum-card sum-neutral">
          <span class="skel" style="width: 80px; display: block; margin-bottom: 12px" />
          <span class="skel" style="width: 60px; height: 28px; display: block" />
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <tbody>
            <tr v-for="i in 6" :key="i" class="skel-row">
              <td><span class="skel mono" style="width: 30px" /></td>
              <td><span class="skel" style="width: 60%" /></td>
              <td><span class="skel" style="width: 50%" /></td>
              <td><span class="skel" style="width: 60px" /></td>
              <td><span class="skel" style="width: 75%" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="reportError">
      <div class="load-error-state" style="margin-top: 40px">
        <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
        <p class="load-error-title">Could not load report</p>
        <p class="load-error-sub">{{ reportError }}</p>
        <button class="link" style="display: inline-flex; align-items: center; gap: 4px" @click="backToList">
          <VIcon name="chevron-left" :size="14" />Back to audit log
        </button>
      </div>
    </template>

    <template v-else-if="report">
      <div class="report-head card card-pad">
        <div>
          <button
            class="link"
            style="font-size: 13px; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 10px"
            @click="backToList"
          >
            <VIcon name="chevron-left" :size="14" />Back to audit log
          </button>
          <h1 class="page-title">Validation report</h1>
          <div class="report-meta">
            <span><VIcon name="file-text" :size="15" /><span class="mono" style="margin-left: 4px">{{ report.filename }}</span></span>
            <span><VIcon name="clock" :size="15" /><span style="margin-left: 4px">{{ report.uploadedAt }}</span></span>
          </div>
        </div>
        <div class="report-actions">
          <VButton
            variant="ghost"
            icon="download"
            @click="toast.show({ tone: 'info', title: 'Download started' })"
          >
            Download corrections CSV
          </VButton>
        </div>
      </div>

      <div class="sum-row">
        <div class="sum-card sum-neutral">
          <div class="sum-cap">TOTAL ROWS EVALUATED</div>
          <div class="sum-val">{{ report.totalRows }}</div>
        </div>
        <div class="sum-card sum-success">
          <div class="sum-cap"><VIcon name="check-circle" :size="15" />&nbsp;ACCEPTED</div>
          <div class="sum-val">{{ report.accepted }}<span class="sum-total"> / {{ report.totalRows }}</span></div>
        </div>
        <div class="sum-card sum-danger">
          <div class="sum-cap"><VIcon name="alert-circle" :size="15" />&nbsp;REJECTED</div>
          <div class="sum-val">{{ report.rejected }}<span class="sum-total"> / {{ report.totalRows }}</span></div>
        </div>
      </div>

      <div class="rej-head">
        <h2 class="sec-title">Rejected rows detail</h2>
        <span class="rej-count">Viewing {{ report.rejectedRows.length }} of {{ report.rejected }} errors</span>
      </div>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Row #</th>
              <th>Learner email</th>
              <th>Failing field</th>
              <th>Rule ID</th>
              <th>Error message</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in report.rejectedRows" :key="row.row">
              <td class="mono">{{ row.row }}</td>
              <td>{{ row.email }}</td>
              <td style="font-weight: 500">{{ row.field }}</td>
              <td><span class="rule-id">{{ row.ruleId }}</span></td>
              <td style="color: var(--danger)">
                <span style="display: inline-flex; gap: 6px; align-items: flex-start">
                  <VIcon name="alert-triangle" :size="15" style="flex-shrink: 0; margin-top: 1px" />
                  {{ row.message }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="callout" style="margin-top: 24px">
        <VIcon name="info" :size="22" style="color: #A83900; flex-shrink: 0; margin-top: 1px" />
        <div>
          <h3 class="callout-title">Partial commit status</h3>
          <p class="callout-body">
            The {{ report.accepted }} valid rows have been successfully committed to the primary database.
            The {{ report.rejected }} rejected rows listed above were skipped. You may correct these specific
            errors in the provided CSV and upload it as a supplemental batch without duplicating the
            successful records.
          </p>
        </div>
      </div>
    </template>
  </template>
</template>
