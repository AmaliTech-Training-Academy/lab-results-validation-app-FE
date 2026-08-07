<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import { useToastStore } from '@/stores/toast'
import { downloadLearnerTemplate, uploadLearnersBulk, fetchLearnerTemplateHeaders, BulkImportError } from '@/services/learner.service'
import type { BulkRowError } from '@/types/bulk.types'

const router = useRouter()
const toast = useToastStore()

const templateCols = ref<string[]>([])
const colsLoading = ref(true)

onMounted(async () => {
  try {
    templateCols.value = await fetchLearnerTemplateHeaders()
  } catch {
    // silently fall back to empty — the toggle simply won't show columns
  } finally {
    colsLoading.value = false
  }
})

const dragOver = ref(false)
const selectedFile = ref<File | null>(null)
const showCols = ref(false)
const importing = ref(false)
const downloadingTemplate = ref(false)

const bulkErrors = ref<BulkRowError[]>([])
const bulkErrorSummary = ref('')

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) {
    selectedFile.value = file
    bulkErrors.value = []
    bulkErrorSummary.value = ''
  }
}

function onFileClick() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      selectedFile.value = file
      bulkErrors.value = []
      bulkErrorSummary.value = ''
    }
  }
  input.click()
}

function clearFile() {
  selectedFile.value = null
  bulkErrors.value = []
  bulkErrorSummary.value = ''
}

function dismissErrors() {
  bulkErrors.value = []
  bulkErrorSummary.value = ''
}

async function handleImport() {
  if (!selectedFile.value) return
  importing.value = true
  bulkErrors.value = []
  bulkErrorSummary.value = ''
  try {
    await uploadLearnersBulk(selectedFile.value)
    toast.show({ tone: 'success', title: 'Learners imported', body: 'Bulk learner records created successfully.' })
    selectedFile.value = null
  } catch (err) {
    if (err instanceof BulkImportError && err.errors.length > 0) {
      bulkErrors.value = err.errors
      const failCount = err.failed ?? err.errors.length
      const createdCount = err.created
      bulkErrorSummary.value = createdCount !== undefined
        ? `${failCount} row${failCount !== 1 ? 's' : ''} failed — ${createdCount} imported successfully.`
        : `${failCount} row${failCount !== 1 ? 's' : ''} failed validation.`
      toast.show({ tone: 'warning', title: 'Import completed with errors', body: bulkErrorSummary.value })
    } else {
      const msg = err instanceof Error ? err.message : ''
      toast.show({ tone: 'warning', title: 'Import failed', body: msg || 'Could not process the CSV. Check the file and try again.' })
    }
  } finally {
    importing.value = false
  }
}

async function handleDownloadTemplate() {
  downloadingTemplate.value = true
  try {
    await downloadLearnerTemplate()
    toast.show({ tone: 'success', title: 'Template downloaded' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    toast.show({ tone: 'warning', title: 'Download failed', body: msg || 'Could not download the CSV template. Please try again.' })
  } finally {
    downloadingTemplate.value = false
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <div class="crumbs" style="margin-bottom: 6px">
        <span style="cursor: pointer" @click="router.push({ name: 'admin-learners' })">Learner roster</span>
        <VIcon name="chevron-right" :size="14" />
        <span class="cur">Bulk setup</span>
      </div>
      <h1 class="page-title">Bulk setup</h1>
    </div>
  </div>

  <div class="bulk-grid">
    <!-- Left: upload -->
    <div class="card card-pad bulk-upload">
      <div class="bulk-cardhead">
        <VIcon name="file-up" :size="20" style="color: var(--orange-deep)" />
        <h2 class="sec-title">Upload learners CSV</h2>
      </div>
      <div
        :class="['dropzone', { over: dragOver }]"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop="onDrop"
        @click="onFileClick"
      >
        <div class="dz-icon"><VIcon name="upload-cloud" :size="32" /></div>
        <template v-if="selectedFile">
          <p class="dz-title">{{ selectedFile.name }}</p>
          <p class="dz-sub">Ready to import learner records</p>
        </template>
        <template v-else>
          <p class="dz-title">Drag your CSV here or click to browse</p>
          <p class="dz-sub">Maximum file size: 10 MB. Must be .csv format.</p>
        </template>
      </div>
      <div style="display: flex; gap: 8px">
        <VButton
          variant="primary"
          icon="play"
          :disabled="!selectedFile || importing"
          style="flex: 1"
          @click="handleImport"
        >
          {{ importing ? 'Importing…' : 'Validate &amp; import' }}
        </VButton>
        <VButton
          v-if="selectedFile"
          variant="ghost"
          icon="x"
          :disabled="importing"
          @click="clearFile"
        >
          Clear
        </VButton>
      </div>

      <div v-if="bulkErrors.length" class="bulk-error-log" role="alert" aria-live="polite">
        <div class="bulk-error-log-head">
          <VIcon name="alert-triangle" :size="16" style="color: var(--danger); flex-shrink: 0" />
          <p class="bulk-error-log-title">{{ bulkErrorSummary || `${bulkErrors.length} row${bulkErrors.length !== 1 ? 's' : ''} failed validation` }}</p>
          <button class="bulk-error-log-dismiss" aria-label="Dismiss errors" @click="dismissErrors">
            <VIcon name="x" :size="16" />
          </button>
        </div>
        <div class="bulk-error-log-body tbl-wrap" style="border: none; border-radius: 0; box-shadow: none">
          <table class="tbl tbl-light">
            <thead>
              <tr>
                <th style="width: 60px">Row</th>
                <th style="width: 140px">Field</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(err, i) in bulkErrors" :key="i">
                <td style="font-variant-numeric: tabular-nums; color: var(--text-secondary)">
                  {{ err.row ?? '—' }}
                </td>
                <td>
                  <span v-if="err.field" class="rule-id">{{ err.field }}</span>
                  <span v-else style="color: var(--text-secondary)">—</span>
                </td>
                <td style="color: var(--danger)">{{ err.message }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Right: template + callout -->
    <div class="bulk-right">
      <div class="card card-pad">
        <div class="bulk-cardhead">
          <VIcon name="file-text" :size="20" style="color: var(--text-secondary)" />
          <h2 class="sec-title">Download the learners template</h2>
        </div>
        <p class="page-sub" style="margin: 10px 0 16px">
          Start from the formatted CSV template to ensure all required fields and
          column headers are in the correct format before importing.
        </p>
        <VButton
          variant="ghost"
          icon="download"
          :disabled="downloadingTemplate"
          style="width: 100%"
          @click="handleDownloadTemplate"
        >
          {{ downloadingTemplate ? 'Downloading…' : 'Download template' }}
        </VButton>
        <button v-if="!colsLoading && templateCols.length" class="bulk-cols-toggle" @click="showCols = !showCols">
          <span>VIEW REQUIRED COLUMNS</span>
          <VIcon :name="showCols ? 'chevron-up' : 'chevron-down'" :size="16" />
        </button>
        <div v-if="showCols" class="bulk-cols">
          <span v-for="col in templateCols" :key="col" class="rule-id">{{ col }}</span>
        </div>
      </div>

      <div class="callout">
        <VIcon name="info" :size="22" style="color: #A83900; flex-shrink: 0" />
        <div>
          <h3 class="callout-title" style="font-size: 15px">Data validation rules</h3>
          <p class="callout-body">
            All four columns are required. Emails are matched case-insensitively —
            duplicates in the file will be skipped. Cohort and specialization names
            must exactly match existing records.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
