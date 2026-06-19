<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import { useToastStore } from '@/stores/toast'
import { getAuditLog, getUploadReport } from '@/services/admin.service'
import type { AuditEntry, ValidationReport } from '@/types/report.types'

const toast = useToastStore()

const view = ref<'list' | 'report'>('list')
const entries = ref<AuditEntry[]>([])
const report = ref<ValidationReport | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadSlow = ref(false)
const LOAD_TIMEOUT_MS = 8000
const reportLoading = ref(false)
const search = ref('')

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

const filteredEntries = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q
    ? entries.value.filter((e) => e.id.toLowerCase().includes(q) || e.file.toLowerCase().includes(q))
    : entries.value
})

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
  report.value = await getUploadReport(entry.id)
  reportLoading.value = false
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
        <span class="selectf-label">Date Range</span>
        <button type="button" class="selectf-btn">
          <span>Oct 1, 2023 – Oct 31, 2023</span>
          <VIcon name="chevron-down" :size="16" style="color: var(--text-secondary)" />
        </button>
      </div>
      <div class="selectf">
        <span class="selectf-label">Instructor</span>
        <button type="button" class="selectf-btn">
          <span>All Instructors</span>
          <VIcon name="chevron-down" :size="16" style="color: var(--text-secondary)" />
        </button>
      </div>
      <div class="selectf">
        <span class="selectf-label">Status</span>
        <button type="button" class="selectf-btn">
          <span>All</span>
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
      <table class="tbl">
        <thead>
          <tr>
            <th>Upload ID</th>
            <th>Instructor</th>
            <th>Filename</th>
            <th>Uploaded at</th>
            <th style="text-align: right">Total rows</th>
            <th style="text-align: center">Accepted</th>
            <th style="text-align: center">Rejected</th>
            <th>Status</th>
            <th style="text-align: right">Actions</th>
          </tr>
        </thead>
        <tbody v-if="isLoading">
          <tr v-for="i in 8" :key="i" class="skel-row">
            <td><span class="skel mono" style="width: 90px" /></td>
            <td><span class="skel" style="width: 55%" /></td>
            <td><span class="skel mono" style="width: 70%" /></td>
            <td><span class="skel" style="width: 80px" /></td>
            <td style="text-align: right"><span class="skel mono" style="width: 40px; display: inline-block" /></td>
            <td style="text-align: center"><span class="skel" style="width: 40px; border-radius: 999px; display: inline-block" /></td>
            <td style="text-align: center"><span class="skel" style="width: 40px; border-radius: 999px; display: inline-block" /></td>
            <td><span class="skel" style="width: 70px; border-radius: 999px" /></td>
            <td style="text-align: right"><span class="skel" style="width: 48px; display: inline-block" /></td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-if="!filteredEntries.length">
            <td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 32px">
              No uploads found.
            </td>
          </tr>
          <tr v-for="entry in filteredEntries" :key="entry.id">
            <td class="mono" style="color: var(--text-secondary)">{{ entry.id }}</td>
            <td style="font-weight: 500">{{ entry.instructor }}</td>
            <td class="mono">{{ entry.file }}</td>
            <td style="color: var(--text-secondary)">{{ entry.uploadedAt }}</td>
            <td class="mono" style="text-align: right">{{ entry.totalRows.toLocaleString() }}</td>
            <td style="text-align: center">
              <span class="count-chip" :style="chipStyle(entry.accepted, 'acc')">
                {{ entry.accepted.toLocaleString() }}
              </span>
            </td>
            <td style="text-align: center">
              <span class="count-chip" :style="chipStyle(entry.rejected, 'rej')">
                {{ entry.rejected.toLocaleString() }}
              </span>
            </td>
            <td>
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
      <div class="pager">
        <span class="pager-count">Showing 1 to {{ filteredEntries.length }} of 42 entries</span>
        <div class="pager-ctrls">
          <button class="pg-arrow" aria-label="Previous"><VIcon name="chevron-left" :size="16" /></button>
          <button class="pg-num on">1</button>
          <button class="pg-num">2</button>
          <button class="pg-num">3</button>
          <span class="pg-ellipsis">…</span>
          <button class="pg-num">9</button>
          <button class="pg-arrow" aria-label="Next"><VIcon name="chevron-right" :size="16" /></button>
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
              <td><span class="skel" style="width: 60%" /></td>
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
