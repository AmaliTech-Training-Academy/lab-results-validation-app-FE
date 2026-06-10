<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import { useToastStore } from '@/stores/toast'
import { downloadLearnerTemplate, uploadLearnersBulk, fetchLearnerTemplateHeaders } from '@/services/learner.service'

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

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) selectedFile.value = file
}

function onFileClick() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) selectedFile.value = file
  }
  input.click()
}

function clearFile() {
  selectedFile.value = null
}

async function handleImport() {
  if (!selectedFile.value) return
  importing.value = true
  try {
    await uploadLearnersBulk(selectedFile.value)
    toast.show({ tone: 'success', title: 'Learners imported', body: 'Bulk learner records created successfully.' })
    selectedFile.value = null
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    toast.show({ tone: 'danger', title: 'Import failed', body: msg || 'Could not process the CSV. Check the file and try again.' })
  } finally {
    importing.value = false
  }
}

async function handleDownloadTemplate() {
  downloadingTemplate.value = true
  try {
    await downloadLearnerTemplate()
    toast.show({ tone: 'success', title: 'Template downloaded' })
  } catch {
    toast.show({ tone: 'warning', title: 'Download failed', body: 'Could not download the CSV template. Please try again.' })
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
