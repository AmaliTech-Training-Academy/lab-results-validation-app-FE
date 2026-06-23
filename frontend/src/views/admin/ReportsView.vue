<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import { useToastStore } from '@/stores/toast'
import { getCsvUploads, getUploadReport, downloadCorrectionsCsv } from '@/services/admin.service'
import { getInstructors } from '@/services/user.service'
import type { InstructorUser } from '@/types/user.types'
import type { CsvUploadEntry, ValidationReport } from '@/types/report.types'

const toast = useToastStore()

const view = ref<'list' | 'report'>('list')
const entries = ref<CsvUploadEntry[]>([])
const report = ref<ValidationReport | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadSlow = ref(false)
const LOAD_TIMEOUT_MS = 8000
const reportLoading = ref(false)

// ── Filter state ──────────────────────────────────────────────────────────────
const startDate = ref('')
const endDate = ref('')
const instructorFilter = ref('')   // holds the selected instructor's email
const statusFilter = ref('')
const search = ref('')
const instructors = ref<InstructorUser[]>([])

const hasActiveFilters = computed(() =>
  !!(startDate.value || endDate.value || instructorFilter.value.trim() || statusFilter.value || search.value.trim()),
)

function clearFilters() {
  startDate.value = ''
  endDate.value = ''
  instructorFilter.value = ''
  statusFilter.value = ''
  search.value = ''
}

// ── Pagination ────────────────────────────────────────────────────────────────
const currentPage = ref(0)
const totalPages = ref(0)
const totalElements = ref(0)
const pageSize = ref(10)
const isLastPage = ref(true)

async function loadData(page = 0) {
  isLoading.value = true
  loadError.value = null
  loadSlow.value = false
  const slowTimer = setTimeout(() => { loadSlow.value = true }, LOAD_TIMEOUT_MS)
  try {
    const result = await getCsvUploads(page, pageSize.value, {
      startDate:       startDate.value       ? `${startDate.value}T00:00:00.000Z`  : undefined,
      endDate:         endDate.value         ? `${endDate.value}T23:59:59.999Z`    : undefined,
      uploadedByEmail: instructorFilter.value.trim() || undefined,
      status:          statusFilter.value    || undefined,
      search:          search.value.trim()   || undefined,
    })
    entries.value = result.content
    currentPage.value = result.page
    totalPages.value = result.totalPages
    totalElements.value = result.totalElements
    isLastPage.value = result.last
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    loadError.value = msg || 'Failed to load audit log. Check your connection and try again.'
  } finally {
    clearTimeout(slowTimer)
    isLoading.value = false
    loadSlow.value = false
  }
}

onMounted(() => {
  loadData(0)
  getInstructors(0, 200).then((res) => { instructors.value = res.content }).catch(() => {})
})

// Select/date filters apply immediately; search text is debounced
watch([startDate, endDate, statusFilter, instructorFilter], () => loadData(0))

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => loadData(0), 400)
})

const pagerStart = computed(() => currentPage.value * pageSize.value + 1)
const pagerEnd = computed(() =>
  Math.min((currentPage.value + 1) * pageSize.value, totalElements.value),
)

const pageNumbers = computed<number[]>(() => {
  const total = totalPages.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const cur = currentPage.value
  const pages = new Set([0, total - 1, cur])
  if (cur > 0) pages.add(cur - 1)
  if (cur < total - 1) pages.add(cur + 1)
  return Array.from(pages).sort((a, b) => a - b)
})

function goToPage(page: number) {
  if (page < 0 || page >= totalPages.value || page === currentPage.value) return
  loadData(page)
}

function deriveStatus(apiStatus: string): { dot: string; label: string } {
  const s = apiStatus.toUpperCase()
  if (s === 'COMPLETED' || s === 'SUCCESS') return { dot: 'var(--success)', label: 'Completed' }
  if (s === 'PARTIAL') return { dot: 'var(--warning)', label: 'Partial' }
  return { dot: 'var(--danger)', label: 'Failed' }
}

function chipStyle(value: number, tone: 'acc' | 'rej'): string {
  if (value === 0) return 'background: #EFEEE9; color: var(--text-secondary)'
  return tone === 'acc'
    ? 'background: var(--success-bg); color: var(--success)'
    : 'background: var(--danger-bg); color: var(--danger)'
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function emailToName(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function truncateFilename(name: string): string {
  return name.length > 10 ? name.slice(0, 10) + '…' : name
}

async function openReport(entry: CsvUploadEntry) {
  view.value = 'report'
  reportLoading.value = true
  report.value = await getUploadReport(entry.id)
  reportLoading.value = false
}

const isDownloading = ref(false)

async function downloadCorrections() {
  if (!report.value || isDownloading.value) return
  isDownloading.value = true
  try {
    const fallback = report.value.filename.replace(/(\.[^.]+)?$/, '-corrections.csv')
    await downloadCorrectionsCsv(report.value.uploadId, fallback)
    toast.show({ tone: 'success', title: 'Download started' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    toast.show({ tone: 'danger', title: 'Download failed', body: msg || undefined })
  } finally {
    isDownloading.value = false
  }
}

function backToList() {
  view.value = 'list'
  report.value = null
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
        <span class="selectf-label">From</span>
        <input v-model="startDate" type="date" class="date-input" />
      </div>
      <div class="selectf">
        <span class="selectf-label">To</span>
        <input v-model="endDate" type="date" class="date-input" />
      </div>
      <div class="selectf">
        <span class="selectf-label">Instructor</span>
        <select v-model="instructorFilter" class="status-select" style="min-width: 170px">
          <option value="">All Instructors</option>
          <option v-for="inst in instructors" :key="inst.id" :value="inst.email">
            {{ emailToName(inst.email) }}
          </option>
        </select>
      </div>
      <div class="selectf">
        <span class="selectf-label">Status</span>
        <select v-model="statusFilter" class="status-select">
          <option value="">All</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="PARTIAL">Partial</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>
      <div class="selectf" style="flex: 1">
        <span class="selectf-label">Search</span>
        <div class="search">
          <VIcon name="search" :size="17" style="color: var(--text-secondary)" />
          <input v-model="search" placeholder="Search by upload ID or filename" />
        </div>
      </div>
      <div v-if="hasActiveFilters" class="selectf" style="align-self: flex-end">
        <button class="link" style="height: 40px; display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--text-secondary)" @click="clearFilters">
          <VIcon name="x" :size="13" /> Clear
        </button>
      </div>
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
      <VButton variant="ghost" icon="rotate-ccw" @click="() => loadData(0)">Try again</VButton>
    </div>

    <div v-else class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="padding-left: 24px">Upload ID</th>
            <th>Instructor</th>
            <th>Filename</th>
            <th>Uploaded at</th>
            <th style="text-align: right">Total rows</th>
            <th style="text-align: center">Accepted</th>
            <th style="text-align: center">Rejected</th>
            <th>Status</th>
            <th style="text-align: right; padding-right: 24px">Actions</th>
          </tr>
        </thead>
        <tbody v-if="isLoading">
          <tr v-for="i in 8" :key="i" class="skel-row">
            <td style="padding-left: 24px"><span class="skel mono" style="width: 90px" /></td>
            <td><span class="skel" style="width: 55%" /></td>
            <td><span class="skel mono" style="width: 70%" /></td>
            <td><span class="skel" style="width: 80px" /></td>
            <td style="text-align: right"><span class="skel mono" style="width: 40px; display: inline-block" /></td>
            <td style="text-align: center"><span class="skel" style="width: 40px; border-radius: 999px; display: inline-block" /></td>
            <td style="text-align: center"><span class="skel" style="width: 40px; border-radius: 999px; display: inline-block" /></td>
            <td><span class="skel" style="width: 70px; border-radius: 999px" /></td>
            <td style="text-align: right; padding-right: 24px"><span class="skel" style="width: 48px; display: inline-block" /></td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-if="!entries.length">
            <td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 32px">
              No uploads found.
            </td>
          </tr>
          <tr v-for="entry in entries" :key="entry.id">
            <td class="mono" style="color: var(--text-secondary); font-size: 12px; padding-left: 24px" :title="entry.id">{{ entry.id.length > 8 ? entry.id.slice(0, 8) + '…' : entry.id }}</td>
            <td style="font-weight: 500">{{ emailToName(entry.uploadedByEmail) }}</td>
            <td class="mono" :title="entry.filename">{{ truncateFilename(entry.filename) }}</td>
            <td style="color: var(--text-secondary)">{{ formatDate(entry.uploadedAt) }}</td>
            <td class="mono" style="text-align: right">{{ entry.totalRows.toLocaleString() }}</td>
            <td style="text-align: center">
              <span class="count-chip" :style="chipStyle(entry.acceptedRows, 'acc')">
                {{ entry.acceptedRows.toLocaleString() }}
              </span>
            </td>
            <td style="text-align: center">
              <span class="count-chip" :style="chipStyle(entry.rejectedRows, 'rej')">
                {{ entry.rejectedRows.toLocaleString() }}
              </span>
            </td>
            <td>
              <span class="pill-dot">
                <span class="dot" :style="{ background: deriveStatus(entry.status).dot }" />
                {{ deriveStatus(entry.status).label }}
              </span>
            </td>
            <td style="text-align: right; padding-right: 24px">
              <button class="link" @click="openReport(entry)">Details</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <span class="pager-count">
          Showing {{ totalElements === 0 ? 0 : pagerStart }} to {{ pagerEnd }} of {{ totalElements.toLocaleString() }} entries
        </span>
        <div class="pager-ctrls">
          <button
            class="pg-arrow"
            aria-label="Previous"
            :disabled="currentPage === 0"
            @click="goToPage(currentPage - 1)"
          >
            <VIcon name="chevron-left" :size="16" />
          </button>
          <template v-for="(pg, idx) in pageNumbers" :key="pg">
            <span v-if="idx > 0 && pg - (pageNumbers[idx - 1] ?? 0) > 1" class="pg-ellipsis">…</span>
            <button
              class="pg-num"
              :class="{ on: pg === currentPage }"
              @click="goToPage(pg)"
            >
              {{ pg + 1 }}
            </button>
          </template>
          <button
            class="pg-arrow"
            aria-label="Next"
            :disabled="isLastPage"
            @click="goToPage(currentPage + 1)"
          >
            <VIcon name="chevron-right" :size="16" />
          </button>
        </div>
      </div>
    </div>
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
              <td><span class="skel" style="width: 50%" /></td>
              <td><span class="skel" style="width: 60px" /></td>
              <td><span class="skel" style="width: 75%" /></td>
            </tr>
          </tbody>
        </table>
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
            <span><VIcon name="clock" :size="15" /><span style="margin-left: 4px">{{ formatDate(report.uploadedAt) }}</span></span>
          </div>
        </div>
        <div class="report-actions">
          <VButton
            variant="ghost"
            icon="download"
            :disabled="isDownloading"
            @click="downloadCorrections"
          >
            {{ isDownloading ? 'Downloading…' : 'Download corrections CSV' }}
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
              <th>Failing field</th>
              <th>Rule ID</th>
              <th>Error message</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in report.rejectedRows" :key="row.row">
              <td class="mono">{{ row.row }}</td>
              <td style="font-weight: 500">{{ row.field }}</td>
              <td>
                <span v-if="row.ruleId !== '—'" class="rule-id">{{ row.ruleId }}</span>
                <span v-else style="color: var(--text-secondary)">—</span>
              </td>
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

<style scoped>
.date-input {
  height: 40px;
  min-width: 130px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  background: #fff;
  cursor: pointer;
}
.date-input:focus {
  outline: none;
  border-color: var(--orange);
  box-shadow: var(--ring-focus);
}

.status-select {
  appearance: none;
  height: 40px;
  min-width: 140px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  background: #fff;
  cursor: pointer;
}
.status-select:focus {
  outline: none;
  border-color: var(--orange);
  box-shadow: var(--ring-focus);
}
</style>
