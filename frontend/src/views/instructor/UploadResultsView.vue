<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { uploadCsv } from '@/services/instructor.service'
import { useToastStore } from '@/stores/toast'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'

const router = useRouter()
const toast = useToastStore()

const file = ref<File | null>(null)
const phase = ref<'idle' | 'processing'>('idle')
const isDragOver = ref(false)

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const dropped = e.dataTransfer?.files[0]
  if (dropped?.name.endsWith('.csv')) file.value = dropped
}

function handleFileInput(e: Event) {
  const picked = (e.target as HTMLInputElement).files?.[0]
  if (picked?.name.endsWith('.csv')) file.value = picked
}

function clearFile() {
  file.value = null
}

async function validate() {
  if (!file.value) return
  phase.value = 'processing'
  try {
    const result = await uploadCsv(file.value)
    toast.show({ tone: 'success', title: 'Upload complete', body: 'Your file has been validated.' })
    router.push({ name: 'instructor-uploads', query: { uploadId: result.uploadId } })
  } catch {
    toast.show({ tone: 'danger', title: 'Upload failed', body: 'Could not process your file. Please try again.' })
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
  </div>
</template>
