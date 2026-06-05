<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const toast = useToastStore()

const STRUCTURE_COLS = [
  'cohort_name', 'specialization_name', 'specialization_code',
  'module_name', 'module_sequence', 'lab_title', 'lab_max_score',
]

const dragOver = ref(false)
const selectedFile = ref<string | null>(null)
const showCols = ref(false)
const importing = ref(false)

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file) selectedFile.value = file.name
}

function onFileClick() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) selectedFile.value = file.name
  }
  input.click()
}

async function handleImport() {
  importing.value = true
  await new Promise((r) => setTimeout(r, 800))
  importing.value = false
  // TODO: replace with → await http.post('/admin/cohorts/bulk-import', formData)
  toast.show({ tone: 'success', title: 'Structure imported', body: 'Cohort hierarchy created successfully.' })
  selectedFile.value = null
}
</script>

<template>
  <div class="page-head">
    <div>
      <div class="crumbs" style="margin-bottom: 6px">
        <span style="cursor: pointer" @click="router.push({ name: 'admin-cohorts' })">Cohorts</span>
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
        <h2 class="sec-title">Upload structure CSV</h2>
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
          <p class="dz-title">{{ selectedFile }}</p>
          <p class="dz-sub">Ready to validate the cohort hierarchy</p>
        </template>
        <template v-else>
          <p class="dz-title">Drag your CSV here or click to browse</p>
          <p class="dz-sub">Maximum file size: 10 MB. Must be .csv format.</p>
        </template>
      </div>
      <VButton
        variant="primary"
        icon="play"
        :disabled="!selectedFile || importing"
        style="width: 100%"
        @click="handleImport"
      >
        {{ importing ? 'Importing…' : 'Validate &amp; import' }}
      </VButton>
    </div>

    <!-- Right: template + callout -->
    <div class="bulk-right">
      <div class="card card-pad">
        <div class="bulk-cardhead">
          <VIcon name="file-text" :size="20" style="color: var(--text-secondary)" />
          <h2 class="sec-title">Download the structure template</h2>
        </div>
        <p class="page-sub" style="margin: 10px 0 16px">
          Ensure your import goes smoothly by starting with our formatted CSV template.
          It includes all required headers and sample data formatting.
        </p>
        <VButton variant="ghost" icon="download" style="width: 100%">
          Download template
        </VButton>
        <button class="bulk-cols-toggle" @click="showCols = !showCols">
          <span>VIEW REQUIRED COLUMNS</span>
          <VIcon :name="showCols ? 'chevron-up' : 'chevron-down'" :size="16" />
        </button>
        <div v-if="showCols" class="bulk-cols">
          <span v-for="col in STRUCTURE_COLS" :key="col" class="rule-id">{{ col }}</span>
        </div>
      </div>

      <div class="callout">
        <VIcon name="info" :size="22" style="color: #A83900; flex-shrink: 0" />
        <div>
          <h3 class="callout-title" style="font-size: 15px">Data validation rules</h3>
          <p class="callout-body">
            Empty fields in required columns will trigger a validation error.
            Ensure date formats exactly match the YYYY-MM-DD standard before importing.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
