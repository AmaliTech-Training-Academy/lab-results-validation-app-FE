<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTemplateData } from '@/services/instructor.service'
import { useToastStore } from '@/stores/toast'
import type { TemplateData } from '@/types/instructor.types'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'

const toast = useToastStore()

const data = ref<TemplateData | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const legendOpen = ref(true)
const columnsOpen = ref(true)

async function loadData() {
  isLoading.value = true
  loadError.value = null
  try {
    data.value = await getTemplateData()
  } catch {
    loadError.value = 'Failed to load template data. Check your connection and try again.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadData)

function downloadTemplate() {
  toast.show({ tone: 'info', title: 'Download started', body: data.value?.filename })
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
    <VButton v-else variant="primary" icon="download" style="width: 100%" @click="downloadTemplate">
      Download {{ data?.filename }}
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
            <tr v-for="col in data?.columns" :key="col.name">
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
