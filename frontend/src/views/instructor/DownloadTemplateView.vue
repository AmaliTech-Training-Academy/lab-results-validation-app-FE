<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchLabResultsTemplateHeaders, getInstructorModulesWithLabs, downloadLabTemplate } from '@/services/instructor.service'
import type { InstructorModuleLabs } from '@/services/instructor.service'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'

const auth = useAuthStore()
const toast = useToastStore()

const COLUMN_META: Record<string, { desc: string; req: boolean }> = {
  learner_email:  { desc: "Must match a learner's email exactly (case-insensitive).", req: true  },
  lab_title:      { desc: 'Exact title from the legend above.',                       req: true  },
  score:          { desc: 'Numeric score achieved. Must not exceed max score.',       req: true  },
  submitted_on:   { desc: 'Date in YYYY-MM-DD format.',                               req: true  },
  attempt_number: { desc: 'Integer — 1 (first) or 2 (retake).',                      req: true  },
  graded_by:      { desc: 'Optional qualitative feedback / instructor name.',         req: true  },
}

const isLoading = ref(true)
const loadError = ref<string | null>(null)
const legendOpen = ref(true)
const columnsOpen = ref(true)
const isDownloading = ref(false)
const templateCols = ref<string[]>([])
const labsByModule = ref<InstructorModuleLabs[]>([])
const selectedLabId = ref<string | null>(null)
const selectedLabTitle = ref<string | null>(null)

const resolvedColumns = computed(() => {
  if (templateCols.value.length) {
    return templateCols.value.map((name) => ({
      name,
      ...(COLUMN_META[name] ?? { desc: '', req: true }),
    }))
  }
  return Object.entries(COLUMN_META).map(([name, meta]) => ({ name, ...meta }))
})

const hasAnyLab = computed(() => labsByModule.value.some((g) => g.labs.length > 0))

async function loadData() {
  isLoading.value = true
  loadError.value = null
  selectedLabId.value = null
  selectedLabTitle.value = null
  const instructorId = auth.user?.userId ?? ''
  try {
    const [moduleLabs, headers] = await Promise.allSettled([
      getInstructorModulesWithLabs(instructorId),
      fetchLabResultsTemplateHeaders(),
    ])
    if (moduleLabs.status === 'fulfilled') {
      labsByModule.value = moduleLabs.value
    } else {
      const reason = (moduleLabs as PromiseRejectedResult).reason
      const msg = reason instanceof Error ? reason.message : ''
      loadError.value = msg || 'Failed to load labs. Check your connection and try again.'
    }
    if (headers.status === 'fulfilled') templateCols.value = headers.value
  } finally {
    isLoading.value = false
  }
}

onMounted(loadData)

function selectLab(labId: string, labTitle: string) {
  selectedLabId.value = labId
  selectedLabTitle.value = labTitle
}

async function downloadTemplate() {
  if (!selectedLabId.value) return
  isDownloading.value = true
  try {
    const filename = await downloadLabTemplate(selectedLabId.value)
    toast.show({ tone: 'success', title: 'Download started', body: filename })
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
        Select a lab from the legend below, then download its pre-formatted CSV template.
      </p>
    </div>

    <!-- Download button -->
    <template v-if="isLoading">
      <span class="skel" style="width: 100%; height: 38px; display: block; border-radius: var(--r-sm)" />
    </template>
    <VButton
      v-else
      variant="primary"
      icon="download"
      style="width: 100%"
      :disabled="isDownloading || !selectedLabId"
      @click="downloadTemplate"
    >
      {{ isDownloading ? 'Downloading…' : selectedLabId ? `Download template for ${selectedLabTitle}` : 'Select a lab above to download' }}
    </VButton>

    <!-- Template legend -->
    <div class="tpl-section">
      <button type="button" class="tpl-sec-head" @click="legendOpen = !legendOpen">
        <span class="sec-title">Available Templates</span>
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
              <th style="width: 36px"></th>
              <th>Module</th>
              <th>Lab title</th>
              <th style="text-align: right">Max score</th>
            </tr>
          </thead>
          <tbody v-if="isLoading">
            <tr v-for="i in 6" :key="i" class="skel-row">
              <td><span class="skel" style="width: 14px; height: 14px; border-radius: 50%; display: inline-block" /></td>
              <td><span class="skel" style="width: 50%" /></td>
              <td><span class="skel mono" style="width: 65%" /></td>
              <td style="text-align: right"><span class="skel mono" style="width: 40px; display: inline-block" /></td>
            </tr>
          </tbody>
          <tbody v-else-if="!hasAnyLab">
            <tr>
              <td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 32px 16px">
                No labs are assigned to your modules yet.
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <template v-for="group in labsByModule" :key="group.moduleId">
              <tr
                v-for="lab in group.labs"
                :key="lab.id"
                class="lab-row"
                :class="{ 'is-selected': selectedLabId === lab.id }"
                @click="selectLab(lab.id, lab.title)"
              >
                <td>
                  <input
                    type="radio"
                    name="lab-select"
                    :value="lab.id"
                    :checked="selectedLabId === lab.id"
                    @change="selectLab(lab.id, lab.title)"
                    @click.stop
                  />
                </td>
                <td style="color: var(--text-secondary)">{{ group.moduleName }}</td>
                <td class="mono">{{ lab.title }}</td>
                <td class="mono" style="text-align: right">{{ lab.maxScore }}</td>
              </tr>
            </template>
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

<style scoped>
.lab-row { cursor: pointer; }
.lab-row:hover { background: var(--surface-alt) !important; }
.lab-row.is-selected { background: rgba(255, 90, 0, 0.07) !important; }
.lab-row input[type='radio'] { accent-color: var(--orange); cursor: pointer; }
</style>
