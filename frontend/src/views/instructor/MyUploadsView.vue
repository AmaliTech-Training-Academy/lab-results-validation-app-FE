<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMyUploads, getUploadReport, downloadCorrectionsCsv } from '@/services/instructor.service'
import type { MyUploadFilters } from '@/services/instructor.service'
import { useToastStore } from '@/stores/toast'
import type { MyUpload } from '@/types/dashboard.types'
import type { ValidationReport } from '@/types/report.types'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()

const uploads = ref<MyUpload[]>([])
const listLoading = ref(true)
const listError = ref<string | null>(null)
const loadSlow = ref(false)
const LOAD_TIMEOUT_MS = 8000

// ── Filter state ──────────────────────────────────────────────────────────────
const startDate = ref('')
const endDate = ref('')
const statusFilter = ref('')
const search = ref('')

const hasActiveFilters = computed(() =>
  !!(startDate.value || endDate.value || statusFilter.value || search.value.trim()),
)

function clearFilters() {
  startDate.value = ''
  endDate.value = ''
  statusFilter.value = ''
  search.value = ''
}

// ── Pagination ────────────────────────────────────────────────────────────────
const currentPage = ref(0)
const totalPages = ref(0)
const totalElements = ref(0)
const pageSize = ref(10)
const isLastPage = ref(true)

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

const report = ref<ValidationReport | null>(null)
const reportLoading = ref(false)
const isDownloading = ref(false)

const activeUploadId = computed(() => route.query.uploadId as string | undefined)

function chipStyle(value: number, tone: 'acc' | 'rej'): string {
  if (value === 0) return 'background: #EFEEE9; color: var(--text-secondary)'
  return tone === 'acc'
    ? 'background: var(--success-bg); color: var(--success)'
    : 'background: var(--danger-bg); color: var(--danger)'
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch { return iso }
}

function truncateFilename(name: string): string {
  return name.length > 10 ? name.slice(0, 10) + '…' : name
}

function statusDot(tone: string): string {
  if (tone === 'success') return 'var(--success)'
  if (tone === 'warning') return 'var(--warning)'
  if (tone === 'info') return 'var(--info)'
  return 'var(--danger)'
}

async function loadUploads(page = 0) {
  listLoading.value = true
  listError.value = null
  loadSlow.value = false
  const slowTimer = setTimeout(() => { loadSlow.value = true }, LOAD_TIMEOUT_MS)
  try {
    const filters: MyUploadFilters = {
      startDate: startDate.value ? `${startDate.value}T00:00:00.000Z` : undefined,
      endDate:   endDate.value   ? `${endDate.value}T23:59:59.999Z`   : undefined,
      status:    statusFilter.value || undefined,
      search:    search.value.trim() || undefined,
    }
    const result = await getMyUploads(page, pageSize.value, filters)
    uploads.value = result.content
    currentPage.value = result.page
    totalPages.value = result.totalPages
    totalElements.value = result.totalElements
    isLastPage.value = result.last
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    listError.value = msg || 'Failed to load uploads. Check your connection and try again.'
  } finally {
    clearTimeout(slowTimer)
    listLoading.value = false
    loadSlow.value = false
  }
}

function goToPage(page: number) {
  if (page < 0 || page >= totalPages.value || page === currentPage.value) return
  loadUploads(page)
}

async function loadReport(uploadId: string) {
  reportLoading.value = true
  report.value = null
  try {
    const listEntry = uploads.value.find((u) => u.uploadId === uploadId)
    report.value = await getUploadReport(uploadId, {
      filename:  listEntry?.file,
      uploadedAt: listEntry?.uploadedAt,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    toast.show({ tone: 'danger', title: 'Could not load report', body: msg || 'Please try again.' })
    router.push({ name: 'instructor-uploads' })
  } finally {
    reportLoading.value = false
  }
}

watch(
  activeUploadId,
  (id) => {
    if (id) loadReport(id)
    else report.value = null
  },
  { immediate: true },
)

watch([startDate, endDate, statusFilter], () => loadUploads(0))

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => loadUploads(0), 400)
})

onMounted(() => loadUploads(0))

function openReport(uploadId: string) {
  router.push({ name: 'instructor-uploads', query: { uploadId } })
}

function backToList() {
  router.push({ name: 'instructor-uploads' })
}

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
</script>

<template>
  <!-- ── Uploads list ──────────────────────────────────────────────────────── -->
  <template v-if="!activeUploadId">
    <div class="page-head">
      <div>
        <h1 class="page-title">My uploads</h1>
        <p class="page-sub">Every CSV you've submitted, with its validation outcome.</p>
      </div>
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
          <input v-model="search" placeholder="Search by filename" />
        </div>
      </div>
      <div v-if="hasActiveFilters" class="selectf" style="align-self: flex-end">
        <button class="link" style="height: 40px; display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--text-secondary)" @click="clearFilters">
          <VIcon name="x" :size="13" /> Clear
        </button>
      </div>
    </div>

    <div v-if="loadSlow && listLoading" class="load-slow-banner">
      <VIcon name="clock" :size="15" />
      This is taking longer than expected…
    </div>

    <div v-else-if="listError && !listLoading" class="load-error-state">
      <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
      <p class="load-error-title">Could not load uploads</p>
      <p class="load-error-sub">{{ listError }}</p>
      <VButton variant="ghost" icon="rotate-ccw" @click="() => loadUploads()">Try again</VButton>
    </div>

    <div v-else class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="padding-left: 24px">Upload ID</th>
            <th>Filename</th>
            <th>Uploaded at</th>
            <th style="text-align: right">Total rows</th>
            <th style="text-align: center">Accepted</th>
            <th style="text-align: center">Rejected</th>
            <th>Status</th>
            <th style="text-align: right; padding-right: 24px">Actions</th>
          </tr>
        </thead>
        <tbody v-if="listLoading">
          <tr v-for="i in 8" :key="i" class="skel-row">
            <td style="padding-left: 24px"><span class="skel mono" style="width: 90px" /></td>
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
          <tr v-if="!uploads.length">
            <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 32px">
              {{ hasActiveFilters ? 'No uploads match your filters.' : 'No uploads yet.' }}
            </td>
          </tr>
          <tr v-for="row in uploads" :key="row.uploadId ?? row.file">
            <td class="mono" style="color: var(--text-secondary); font-size: 12px; padding-left: 24px" :title="row.uploadId">
              {{ row.uploadId ? (row.uploadId.length > 8 ? row.uploadId.slice(0, 8) + '…' : row.uploadId) : '—' }}
            </td>
            <td class="mono" :title="row.file">{{ truncateFilename(row.file) }}</td>
            <td style="color: var(--text-secondary)">{{ formatDate(row.uploadedAt) }}</td>
            <td class="mono" style="text-align: right">{{ row.totalRows.toLocaleString() }}</td>
            <td style="text-align: center">
              <span class="count-chip" :style="chipStyle(row.accepted, 'acc')">
                {{ row.accepted.toLocaleString() }}
              </span>
            </td>
            <td style="text-align: center">
              <span class="count-chip" :style="chipStyle(row.rejected, 'rej')">
                {{ row.rejected.toLocaleString() }}
              </span>
            </td>
            <td>
              <span class="pill-dot">
                <span class="dot" :style="{ background: statusDot(row.tone) }" />
                {{ row.status }}
              </span>
            </td>
            <td style="text-align: right; padding-right: 24px">
              <button v-if="row.hasReport && row.uploadId" class="link" @click="openReport(row.uploadId!)">Details</button>
              <span v-else style="color: var(--text-muted)">—</span>
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

  <!-- ── Validation report detail ─────────────────────────────────────────── -->
  <template v-else>
    <!-- Loading skeleton -->
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
            <tr v-for="i in 5" :key="i" class="skel-row">
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

    <!-- Report content -->
    <template v-else-if="report">
      <div class="report-head card card-pad">
        <div>
          <button
            class="link"
            style="font-size: 13px; display: inline-flex; align-items: center; gap: 4px; margin-bottom: 10px"
            @click="backToList"
          >
            <VIcon name="chevron-left" :size="14" />Back to my uploads
          </button>
          <h1 class="page-title">Validation report</h1>
          <div class="report-meta">
            <span>
              <VIcon name="file-text" :size="15" />
              <span class="mono" style="margin-left: 4px">{{ report.filename }}</span>
            </span>
            <span>
              <VIcon name="clock" :size="15" />
              <span style="margin-left: 4px">{{ formatDate(report.uploadedAt) }}</span>
            </span>
          </div>
        </div>
        <div v-if="report.rejected > 0" class="report-actions">
          <VButton variant="ghost" icon="download" :disabled="isDownloading" @click="downloadCorrections">
            {{ isDownloading ? 'Downloading…' : 'Download corrections CSV' }}
          </VButton>
          <VButton variant="primary" icon="upload" @click="router.push({ name: 'instructor-upload' })">
            Re-upload fixed file
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
          <div class="sum-val">
            {{ report.accepted }}<span class="sum-total"> / {{ report.totalRows }}</span>
          </div>
        </div>
        <div class="sum-card sum-danger">
          <div class="sum-cap"><VIcon name="alert-circle" :size="15" />&nbsp;REJECTED</div>
          <div class="sum-val">
            {{ report.rejected }}<span class="sum-total"> / {{ report.totalRows }}</span>
          </div>
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
            The {{ report.accepted }} valid rows have been successfully committed to the primary
            database. The {{ report.rejected }} rejected rows listed above were skipped. You may
            correct these specific errors in the provided CSV and upload it as a supplemental batch
            without duplicating the successful records.
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
