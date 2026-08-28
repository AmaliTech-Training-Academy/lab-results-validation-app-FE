<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { uploadCsv, BulkImportError } from '@/services/instructor.service'
import { useToastStore } from '@/stores/toast'
import type { BulkRowError } from '@/types/bulk.types'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import { usePageTitle } from '@/composables/usePageTitle'

usePageTitle('Upload Results')

const router = useRouter()
const toast = useToastStore()

const file = ref<File | null>(null)
const phase = ref<'idle' | 'processing'>('idle')
const isDragOver = ref(false)

const bulkErrors = ref<BulkRowError[]>([])
const bulkErrorSummary = ref('')

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const dropped = e.dataTransfer?.files[0]
  if (dropped?.name.endsWith('.csv')) {
    file.value = dropped
    bulkErrors.value = []
    bulkErrorSummary.value = ''
  }
}

function handleFileInput(e: Event) {
  const picked = (e.target as HTMLInputElement).files?.[0]
  if (picked?.name.endsWith('.csv')) {
    file.value = picked
    bulkErrors.value = []
    bulkErrorSummary.value = ''
  }
}

function clearFile() {
  file.value = null
  bulkErrors.value = []
  bulkErrorSummary.value = ''
}

function dismissErrors() {
  bulkErrors.value = []
  bulkErrorSummary.value = ''
}

function isCohortLockedError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('locked')
}

async function validate() {
  if (!file.value) return
  phase.value = 'processing'
  bulkErrors.value = []
  bulkErrorSummary.value = ''
  try {
    const result = await uploadCsv(file.value)
    toast.show({ tone: 'success', title: 'Upload complete', body: 'Your file has been validated.' })
    router.push({ name: 'instructor-uploads', query: { uploadId: result.uploadId } })
  } catch (err) {
    if (err instanceof BulkImportError && err.errors.length > 0) {
      bulkErrors.value = err.errors
      const failCount = err.failed ?? err.errors.length
      const createdCount = err.created
      bulkErrorSummary.value = createdCount !== undefined
        ? `${failCount} row${failCount !== 1 ? 's' : ''} failed — ${createdCount} imported successfully.`
        : `${failCount} row${failCount !== 1 ? 's' : ''} failed validation.`
      toast.show({ tone: 'warning', title: 'Upload completed with errors', body: bulkErrorSummary.value })
    } else if (isCohortLockedError(err)) {
      toast.show({ tone: 'warning', title: 'Cohort is locked', body: 'Results cannot be uploaded until the cohort is locked for grading.' })
    } else {
      const msg = err instanceof Error ? err.message : ''
      toast.show({ tone: 'danger', title: 'Upload failed', body: msg || 'Could not process your file. Please try again.' })
    }
    phase.value = 'idle'
  }
}
</script>

<template>
  <div class="page-head">
    <h1 class="page-title">Upload results</h1>
  </div>

  <div class="card card-pad upload-card">
    <h2 class="upload-title">Upload lab results CSV</h2>

    <!-- Processing state -->
    <div v-if="phase === 'processing'" class="dropzone" style="cursor: default">
      <div class="dz-icon"><span class="spinner" /></div>
      <p class="dz-title">Validating {{ file?.name }}</p>
      <p class="dz-sub">Running structural, field, and referential checks…</p>
      <div class="upload-progress"><span class="upload-progress-bar" /></div>
    </div>

    <!-- Idle / file-selected state -->
    <label
      v-else
      class="dropzone"
      :class="{ over: isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave="isDragOver = false"
      @drop="handleDrop"
    >
      <input
        type="file"
        accept=".csv"
        style="display: none"
        @change="handleFileInput"
      />
      <div class="dz-icon"><VIcon name="upload-cloud" :size="32" /></div>
      <template v-if="file">
        <p class="dz-title">{{ file.name }}</p>
        <p class="dz-sub">
          Ready to validate ·
          <button
            type="button"
            class="link"
            style="font-size: inherit"
            @click.prevent="clearFile"
          >Remove</button>
        </p>
      </template>
      <template v-else>
        <p class="dz-title">Drop your CSV here</p>
        <p class="dz-sub">or click to browse · .csv only · max 5 MB or 10,000 rows</p>
      </template>
    </label>

    <VButton
      variant="primary"
      :disabled="!file || phase === 'processing'"
      style="width: 100%"
      @click="validate"
    >
      {{ phase === 'processing' ? 'Validating…' : 'Validate & upload' }}
    </VButton>

    <div class="hint">
      <VIcon name="lightbulb" :size="16" />
      Need the template?
      <router-link :to="{ name: 'instructor-template' }" class="link">Download it here.</router-link>
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
</template>
