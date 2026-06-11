<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMyUploads, getUploadReport } from '@/services/instructor.service'
import { useToastStore } from '@/stores/toast'
import type { MyUpload } from '@/types/dashboard.types'
import type { ValidationReport } from '@/types/report.types'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()

const uploads = ref<MyUpload[]>([])
const listLoading = ref(true)
const listError = ref<string | null>(null)

const report = ref<ValidationReport | null>(null)
const reportLoading = ref(false)

const activeUploadId = computed(() => route.query.uploadId as string | undefined)

async function loadUploads() {
  listLoading.value = true
  listError.value = null
  try {
    uploads.value = await getMyUploads()
  } catch {
    listError.value = 'Failed to load uploads. Check your connection and try again.'
  } finally {
    listLoading.value = false
  }
}

async function loadReport(uploadId: string) {
  reportLoading.value = true
  report.value = null
  try {
    report.value = await getUploadReport(uploadId)
  } catch {
    toast.show({ tone: 'danger', title: 'Could not load report', body: 'Please try again.' })
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

onMounted(loadUploads)

function openReport(uploadId: string) {
  router.push({ name: 'instructor-uploads', query: { uploadId } })
}

function backToList() {
  router.push({ name: 'instructor-uploads' })
}

function downloadCorrections() {
  toast.show({ tone: 'info', title: 'Download started', body: report.value?.filename })
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

    <div v-if="listError && !listLoading" class="load-error-state">
      <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
      <p class="load-error-title">Could not load uploads</p>
      <p class="load-error-sub">{{ listError }}</p>
      <VButton variant="ghost" icon="rotate-ccw" @click="loadUploads">Try again</VButton>
    </div>

    <div v-else class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>File</th>
            <th>Date</th>
            <th>Accepted</th>
            <th>Rejected</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody v-if="listLoading">
          <tr v-for="i in 5" :key="i" class="skel-row">
            <td><span class="skel mono" style="width: 65%" /></td>
            <td><span class="skel" style="width: 80px" /></td>
            <td><span class="skel mono" style="width: 30px; display: inline-block" /></td>
            <td><span class="skel mono" style="width: 30px; display: inline-block" /></td>
            <td><span class="skel" style="width: 80px; border-radius: 999px" /></td>
            <td><span class="skel" style="width: 70px; display: inline-block" /></td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-if="!uploads.length">
            <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 32px">
              No uploads yet.
            </td>
          </tr>
          <tr v-for="(row, i) in uploads" :key="i">
            <td>
              <span style="display: inline-flex; align-items: center; gap: 9px">
                <VIcon name="file-text" :size="16" style="color: var(--text-secondary)" />
                <span class="mono">{{ row.file }}</span>
              </span>
            </td>
            <td style="color: var(--text-secondary)">{{ row.date }}</td>
            <td>{{ row.accepted }}</td>
            <td
              :style="{
                color: row.rejected > 0 ? 'var(--danger)' : 'inherit',
                fontWeight: row.rejected > 0 ? 600 : 400,
              }"
            >{{ row.rejected }}</td>
            <td><VPill :tone="row.tone">{{ row.status }}</VPill></td>
            <td>
              <button
                v-if="row.hasReport && row.uploadId"
                class="link"
                @click="openReport(row.uploadId!)"
              >View report →</button>
              <span v-else style="color: var(--text-muted)">—</span>
            </td>
          </tr>
        </tbody>
      </table>
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
              <span style="margin-left: 4px">{{ report.uploadedAt }}</span>
            </span>
          </div>
        </div>
        <div class="report-actions">
          <VButton variant="ghost" icon="download" @click="downloadCorrections">
            Download corrections CSV
          </VButton>
          <VButton variant="primary" icon="upload" :to="{ name: 'instructor-upload' }">
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
