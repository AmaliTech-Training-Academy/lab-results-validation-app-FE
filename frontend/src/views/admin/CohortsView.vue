<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import VDatePicker from '@/components/base/VDatePicker.vue'
import { useToastStore } from '@/stores/toast'
import { getCohorts, createCohort, updateCohort, toggleCohortActive } from '@/services/cohort.service'
import type { CohortRow } from '@/types/cohort.types'

const router = useRouter()
const toast = useToastStore()

// ── Data ─────────────────────────────────────────────────────────────────────
const cohorts = ref<CohortRow[]>([])
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadSlow = ref(false)
const LOAD_TIMEOUT_MS = 8000

// ── Drawer ────────────────────────────────────────────────────────────────────
const showDrawer = ref(false)
const editTarget = ref<CohortRow | null>(null)
const submitting = ref(false)
const form = ref({ name: '', startDate: '', endDate: '', error: '' })

// ── Kebab ─────────────────────────────────────────────────────────────────────
const activeKebabId = ref<string | null>(null)

// ── Helpers ───────────────────────────────────────────────────────────────────
const drawerTitle = computed(() => editTarget.value ? 'Edit cohort' : 'Create new cohort')

const dateRangeError = computed(() => {
  if (!form.value.startDate || !form.value.endDate) return ''
  return form.value.endDate < form.value.startDate ? 'End date must be after start date.' : ''
})

// ── Pagination ────────────────────────────────────────────────────────────────
const currentPage = ref(0)
const totalElements = ref(0)
const totalPages = ref(0)
const PAGE_SIZE = 10

// ── Lifecycle ─────────────────────────────────────────────────────────────────
async function loadCohorts(page = currentPage.value) {
  isLoading.value = true
  loadError.value = null
  loadSlow.value = false

  const slowTimer = setTimeout(() => { loadSlow.value = true }, LOAD_TIMEOUT_MS)
  try {
    const result = await getCohorts(page, PAGE_SIZE)
    cohorts.value = result.content
    currentPage.value = result.page
    totalElements.value = result.totalElements
    totalPages.value = result.totalPages
  } catch {
    loadError.value = 'Failed to load cohorts. Check your connection and try again.'
  } finally {
    clearTimeout(slowTimer)
    isLoading.value = false
    loadSlow.value = false
  }
}

onMounted(() => {
  loadCohorts()
  window.addEventListener('click', closeKebab)
})

onUnmounted(() => {
  window.removeEventListener('click', closeKebab)
})

// ── Actions ───────────────────────────────────────────────────────────────────
function closeKebab() {
  activeKebabId.value = null
}

function toggleKebab(event: MouseEvent, id: string) {
  event.stopPropagation()
  activeKebabId.value = activeKebabId.value === id ? null : id
}

function openCreate() {
  editTarget.value = null
  form.value = { name: '', startDate: '', endDate: '',  error: '' }
  showDrawer.value = true
}

function openEdit(cohort: CohortRow) {
  activeKebabId.value = null
  editTarget.value = cohort
  form.value = { name: cohort.name, startDate: cohort.startDate, endDate: cohort.endDate, error: '' }
  showDrawer.value = true
}

function closeDrawer() {
  showDrawer.value = false
  editTarget.value = null
  form.value = { name: '', startDate: '', endDate: '', error: '' }
}

async function submitForm() {
  form.value.error = ''
  if (!form.value.name.trim() || !form.value.startDate || !form.value.endDate) {
    form.value.error = 'Name, start date, and end date are required.'
    return
  }
  if (dateRangeError.value) {
    form.value.error = dateRangeError.value
    return
  }
  submitting.value = true
  const payload = { name: form.value.name.trim(), startDate: form.value.startDate, endDate: form.value.endDate }
  try {
    if (editTarget.value) {
      const updated = await updateCohort(editTarget.value.id, payload)
      const idx = cohorts.value.findIndex((c) => c.id === editTarget.value!.id)
      if (idx !== -1) {
        cohorts.value[idx]!.name = updated.name
        cohorts.value[idx]!.startDate = updated.startDate
        cohorts.value[idx]!.endDate = updated.endDate
      }
      toast.show({ tone: 'success', title: 'Cohort updated' })
    } else {
      const created = await createCohort(payload)
      cohorts.value.push(created)
      toast.show({ tone: 'success', title: 'Cohort created' })
    }
    closeDrawer()
  } catch {
    form.value.error = editTarget.value ? 'Failed to update cohort. Please try again.' : 'Failed to create cohort. Please try again.'
  } finally {
    submitting.value = false
  }
}

function cohortStatus(c: CohortRow): 'active' | 'completed' | 'archived' {
  const today = new Date().toISOString().split('T')[0]!
  if (c.endDate < today) return 'completed'
  return c.active ? 'active' : 'archived'
}

async function toggleActive(cohort: CohortRow) {
  activeKebabId.value = null
  const newActive = !cohort.active
  try {
    await toggleCohortActive(cohort.id, newActive)
    const idx = cohorts.value.findIndex((c) => c.id === cohort.id)
    if (idx !== -1) cohorts.value[idx]!.active = newActive
    toast.show({ tone: 'success', title: newActive ? 'Cohort restored' : 'Cohort archived' })
  } catch {
    toast.show({ tone: 'warning', title: 'Action failed. Please try again.' })
  }
}
</script>

<template>
  <!-- Page header -->
  <div class="page-head">
    <div>
      <div class="crumbs" style="margin-bottom: 6px">
        <span>Admin</span>
        <VIcon name="chevron-right" :size="14" />
        <span class="cur">Cohorts</span>
      </div>
      <h1 class="page-title">Cohorts</h1>
    </div>
    <div style="display: flex; gap: 12px">
      <VButton variant="ghost" icon="upload" @click="router.push({ name: 'admin-cohorts-bulk' })">
        Bulk setup
      </VButton>
      <VButton variant="primary" icon="plus" @click="openCreate">Create new cohort</VButton>
    </div>
  </div>

  <!-- Slow-connection warning -->
  <div v-if="loadSlow && isLoading" class="load-slow-banner">
    <VIcon name="clock" :size="15" />
    This is taking longer than expected…
  </div>

  <!-- Error state -->
  <div v-if="loadError && !isLoading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load cohorts</p>
    <p class="load-error-sub">{{ loadError }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="() => loadCohorts()">Try again</VButton>
  </div>

  <!-- Table (loading skeleton + real data) -->
  <div v-else class="tbl-wrap">
    <table class="tbl">
      <thead>
        <tr>
          <th>Cohort Name</th>
          <th>Start Date</th>
          <th>End Date</th>
          <th style="text-align: center">Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody v-if="isLoading">
        <tr v-for="i in 5" :key="i" class="skel-row">
          <td><span class="skel" style="width: 55%" /></td>
          <td><span class="skel mono" style="width: 80px" /></td>
          <td><span class="skel mono" style="width: 80px" /></td>
          <td style="text-align: center"><span class="skel" style="width: 64px; border-radius: 999px" /></td>
          <td style="text-align: right"><span class="skel" style="width: 24px; display: inline-block" /></td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="c in cohorts" :key="c.id">
          <td style="font-weight: 600">{{ c.name }}</td>
          <td class="mono" style="color: var(--text-secondary)">{{ c.startDate }}</td>
          <td class="mono" style="color: var(--text-secondary)">{{ c.endDate }}</td>
          <td style="text-align: center">
            <VPill :tone="cohortStatus(c) === 'active' ? 'warning' : cohortStatus(c) === 'completed' ? 'success' : 'info'">
              {{ cohortStatus(c) === 'active' ? 'Active' : cohortStatus(c) === 'completed' ? 'Completed' : 'Archived' }}
            </VPill>
          </td>
          <td style="text-align: right; width: 48px; position: relative">
            <button class="kebab" aria-label="Actions" @click="toggleKebab($event, c.id)">
              <VIcon name="more-vertical" :size="18" />
            </button>
            <div
              v-if="activeKebabId === c.id"
              style="position: absolute; right: 0; top: 36px; z-index: 20; background: #fff; border: 1px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow-pop); min-width: 160px; overflow: hidden"
              @click.stop
            >
              <button
                style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 16px; border: none; background: none; font-family: inherit; font-size: 14px; color: var(--text); cursor: pointer; text-align: left"
                @mouseenter="($event.target as HTMLElement).style.background = 'var(--bg)'"
                @mouseleave="($event.target as HTMLElement).style.background = 'none'"
                @click="openEdit(c)"
              >
                <VIcon name="pencil" :size="15" style="color: var(--text-secondary)" />
                Edit
              </button>
              <button
                style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 16px; border: none; background: none; font-family: inherit; font-size: 14px; color: var(--text); cursor: pointer; text-align: left"
                @mouseenter="($event.target as HTMLElement).style.background = 'var(--bg)'"
                @mouseleave="($event.target as HTMLElement).style.background = 'none'"
                @click="toggleActive(c)"
              >
                <VIcon :name="c.active ? 'archive' : 'rotate-ccw'" :size="15" style="color: var(--text-secondary)" />
                {{ c.active ? 'Archive' : 'Restore' }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div v-if="!isLoading && totalElements > 0" class="pager">
      <span class="pager-count">
        Showing {{ currentPage * PAGE_SIZE + 1 }}–{{ Math.min((currentPage + 1) * PAGE_SIZE, totalElements) }} of {{ totalElements }}
      </span>
      <div class="pager-ctrls">
        <button class="pg-arrow" aria-label="Previous" :disabled="currentPage === 0" @click="loadCohorts(currentPage - 1)">
          <VIcon name="chevron-left" :size="16" />
        </button>
        <button
          v-for="p in totalPages"
          :key="p"
          :class="['pg-num', { on: p - 1 === currentPage }]"
          @click="loadCohorts(p - 1)"
        >{{ p }}</button>
        <button class="pg-arrow" aria-label="Next" :disabled="currentPage >= totalPages - 1" @click="loadCohorts(currentPage + 1)">
          <VIcon name="chevron-right" :size="16" />
        </button>
      </div>
    </div>
  </div>

  <!-- Create / Edit Drawer -->
  <VDrawer
    :open="showDrawer"
    :title="drawerTitle"
    subtitle="A cohort is a time-bound group of learners progressing together."
    @close="closeDrawer"
  >
    <label class="ff">
      <span class="ff-label">Cohort name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="form.name" placeholder="e.g. Cohort 8 — Spring 2026" />
      </span>
    </label>
    <div class="ff-row">
      <VDatePicker
        v-model="form.startDate"
        label="Start date"
        required
        :max="form.endDate || undefined"
      />
      <VDatePicker
        v-model="form.endDate"
        label="End date"
        required
        :min="form.startDate || undefined"
        :error="dateRangeError"
      />
    </div>
    <p v-if="form.error" class="field-error">
      <VIcon name="alert-circle" :size="14" />{{ form.error }}
    </p>
    <template #footer>
      <VButton variant="ghost" @click="closeDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitForm">
        {{ editTarget ? 'Save changes' : 'Create cohort' }}
      </VButton>
    </template>
  </VDrawer>
</template>

