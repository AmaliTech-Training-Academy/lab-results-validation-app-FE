<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getTemplateData, downloadLabResultsTemplate, fetchLabResultsTemplateHeaders } from '@/services/instructor.service'
import { useToastStore } from '@/stores/toast'
import type { TemplateData } from '@/types/instructor.types'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import { usePageTitle } from '@/composables/usePageTitle'

usePageTitle('Download Template')

const toast = useToastStore()

const COLUMN_META: Record<string, { desc: string; req: boolean }> = {
  learner_email:  { desc: "Must match a learner's email exactly (case-insensitive).", req: true  },
  lab_title:      { desc: 'Exact title from the legend above.',                       req: true  },
  score:          { desc: 'Numeric score achieved. Must not exceed max score.',       req: true  },
  submitted_on:   { desc: 'Date in YYYY-MM-DD format.',                               req: true  },
  attempt_number: { desc: 'Integer — 1 (first) or 2 (retake).',                      req: true  },
  graded_by:      { desc: 'Optional qualitative feedback / instructor name.',         req: true  },
}

const data = ref<TemplateData | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const legendOpen = ref(true)
const columnsOpen = ref(true)
const isDownloading = ref(false)
const templateCols = ref<string[]>([])

const resolvedColumns = computed(() => {
  if (templateCols.value.length) {
    return templateCols.value.map((name) => ({
      name,
      ...(COLUMN_META[name] ?? { desc: '', req: true }),
    }))
  }
  return data.value?.columns ?? []
})

async function loadData() {
  isLoading.value = true
  loadError.value = null
  try {
    const [templateData, headers] = await Promise.allSettled([
      getTemplateData(),
      fetchLabResultsTemplateHeaders(),
    ])
    if (templateData.status === 'fulfilled') data.value = templateData.value
    else {
      const reason = (templateData as PromiseRejectedResult).reason
      const msg = reason instanceof Error ? reason.message : ''
      loadError.value = msg || 'Failed to load template data. Check your connection and try again.'
    }
    if (headers.status === 'fulfilled') templateCols.value = headers.value
  } finally {
    isLoading.value = false
  }
}

onMounted(loadData)

async function downloadTemplate() {
  isDownloading.value = true
  try {
    await downloadLabResultsTemplate()
    toast.show({ tone: 'success', title: 'Download started', body: data.value?.filename })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    toast.show({ tone: 'danger', title: 'Download failed', body: msg || 'Could not download the template. Please try again.' })
  } finally {
    isDownloading.value = false
  }
}
</script>

<template>
  <div class="page-head">
    <h1 class="page-title">Download template</h1>
  </div>

  <!-- Error state -->
  <div v-if="loadError && !isLoading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load template data</p>
    <p class="load-error-sub">{{ loadError }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="loadData">Try again</VButton>
  </div>

  <div v-else class="card card-pad tpl-card">
    <!-- Intro -->
    <div class="tpl-intro">
      <h2 class="upload-title">Your personalised CSV template</h2>
      <p class="dz-sub" style="text-align: center; max-width: 560px; margin: 8px auto 0">
        This template is pre-scoped to your assigned modules. Use the exact lab titles listed in the
        legend below.
      </p>
    </div>

    <!-- Download button -->
    <template v-if="isLoading">
      <span class="skel" style="width: 100%; height: 38px; display: block; border-radius: var(--r-sm)" />
    </template>
    <VButton v-else variant="primary" icon="download" style="width: 100%" :disabled="isDownloading" @click="downloadTemplate">
      {{ isDownloading ? 'Downloading…' : `Download ${data?.filename}` }}
    </VButton>

    <!-- Template legend -->
    <div class="tpl-section">
      <button type="button" class="tpl-sec-head" @click="legendOpen = !legendOpen">
        <span class="sec-title">Template legend</span>
        <VIcon
          name="chevron-up"
          :size="18"
          style="color: var(--text-secondary); transition: transform 0.2s"
          :style="legendOpen ? '' : 'transform: rotate(180deg)'"
        />
      </button>
      <div v-if="legendOpen" class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Module / Lab title</th>
              <th style="text-align: right">Max score</th>
            </tr>
          </thead>
          <tbody v-if="isLoading">
            <tr v-for="i in 6" :key="i" class="skel-row">
              <td><span class="skel mono" style="width: 65%" /></td>
              <td style="text-align: right"><span class="skel mono" style="width: 40px; display: inline-block" /></td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr v-for="row in data?.legend" :key="row.lab">
              <td class="mono" style="text-align: center">{{ row.lab }}</td>
              <td class="mono" style="text-align: right">{{ row.max }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- CSV column reference -->
    <div class="tpl-section">
      <button type="button" class="tpl-sec-head" @click="columnsOpen = !columnsOpen">
        <span class="sec-title">CSV column reference</span>
        <VIcon
          name="chevron-up"
          :size="18"
          style="color: var(--text-secondary); transition: transform 0.2s"
          :style="columnsOpen ? '' : 'transform: rotate(180deg)'"
        />
      </button>
      <div v-if="columnsOpen" class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Column name</th>
              <th>Description</th>
              <th style="text-align: right">Required</th>
            </tr>
          </thead>
          <tbody v-if="isLoading">
            <tr v-for="i in 6" :key="i" class="skel-row">
              <td><span class="skel mono" style="width: 55%" /></td>
              <td><span class="skel" style="width: 75%" /></td>
              <td style="text-align: right"><span class="skel" style="width: 30px; border-radius: 999px; display: inline-block" /></td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr v-for="col in resolvedColumns" :key="col.name">
              <td class="mono">{{ col.name }}</td>
              <td style="color: var(--text-secondary)">{{ col.desc }}</td>
              <td style="text-align: right">
                <span v-if="col.req" class="req-yes">Yes</span>
                <span v-else class="req-no">No</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
