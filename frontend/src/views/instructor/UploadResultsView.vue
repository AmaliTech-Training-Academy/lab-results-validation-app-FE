<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { uploadCsv, BulkImportError } from '@/services/instructor.service'
import { useToastStore } from '@/stores/toast'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VModal from '@/components/base/VModal.vue'

const router = useRouter()
const toast = useToastStore()

const file = ref<File | null>(null)
const phase = ref<'idle' | 'processing'>('idle')
const isDragOver = ref(false)
const fileError = ref('')

const showReportPrompt = ref(false)
const pendingUploadId = ref<string | null>(null)

const MAX_MB = 5

function validateFile(f: File): string {
  if (!f.name.toLowerCase().endsWith('.csv') && f.type !== 'text/csv') {
    return `"${f.name}" is not a CSV file. Only .csv files are accepted.`
  }
  if (f.size > MAX_MB * 1024 * 1024) {
    return `"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)} MB — exceeds the ${MAX_MB} MB limit.`
  }
  return ''
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const dropped = e.dataTransfer?.files[0]
  if (!dropped) return
  const err = validateFile(dropped)
  if (err) { fileError.value = err; file.value = null; return }
  file.value = dropped
  fileError.value = ''
}

function handleFileInput(e: Event) {
  const picked = (e.target as HTMLInputElement).files?.[0]
  if (!picked) return
  const err = validateFile(picked)
  if (err) { fileError.value = err; file.value = null; return }
  file.value = picked
  fileError.value = ''
}

function clearFile() {
  file.value = null
  fileError.value = ''
}

function goToReport() {
  router.push({ name: 'instructor-uploads', query: { uploadId: pendingUploadId.value ?? undefined } })
}

function dismissPrompt() {
  showReportPrompt.value = false
  pendingUploadId.value = null
  clearFile()
}

function isCohortLockedError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('locked')
}

async function validate() {
  if (!file.value) return
  phase.value = 'processing'
  try {
    const result = await uploadCsv(file.value)
    pendingUploadId.value = result.uploadId
    showReportPrompt.value = true
    phase.value = 'idle'
  } catch (err) {
    if (err instanceof BulkImportError && err.errors.length > 0) {
      const failCount = err.failed ?? err.errors.length
      const createdCount = err.created
      const body = createdCount !== undefined
        ? `${failCount} row${failCount !== 1 ? 's' : ''} failed — ${createdCount} imported successfully.`
        : `${failCount} row${failCount !== 1 ? 's' : ''} failed validation.`
      toast.show({ tone: 'warning', title: 'Upload completed with errors', body })
      if (err.uploadId) {
        pendingUploadId.value = err.uploadId
        showReportPrompt.value = true
      }
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

    <div v-if="fileError" class="bulk-error-log" role="alert" aria-live="polite">
      <div class="bulk-error-log-head">
        <VIcon name="alert-circle" :size="16" style="color: var(--danger); flex-shrink: 0" />
        <p class="bulk-error-log-title">{{ fileError }}</p>
        <button class="bulk-error-log-dismiss" aria-label="Dismiss" @click="fileError = ''">
          <VIcon name="x" :size="16" />
        </button>
      </div>
    </div>

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
  </div>

  <VModal
    :open="showReportPrompt"
    title="Upload complete"
    subtitle="Your file was validated and processed successfully."
    @close="dismissPrompt"
  >
    <p style="font-size: 14px; color: var(--text-secondary); margin: 0">
      Would you like to view the full upload report now?
    </p>
    <template #footer>
      <VButton variant="ghost" @click="dismissPrompt">Maybe later</VButton>
      <VButton variant="primary" icon="file-text" @click="goToReport">View report</VButton>
    </template>
  </VModal>
</template>
