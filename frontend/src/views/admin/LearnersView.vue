<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import { useToastStore } from '@/stores/toast'
import { getLearners, addLearner, updateLearner, setLearnerStatus } from '@/services/learner.service'
import { getCohorts } from '@/services/cohort.service'
import { getSpecializations } from '@/services/reference.service'
import type { Learner, LearnerStatus } from '@/types/learner.types'
import type { CohortRow } from '@/types/cohort.types'
import type { Specialization } from '@/types/reference.types'

const toast = useToastStore()

const PAGE_SIZE = 10

// ── Data ─────────────────────────────────────────────────────────────────────
const learners = ref<Learner[]>([])
const cohortOptions = ref<CohortRow[]>([])
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadSlow = ref(false)
const LOAD_TIMEOUT_MS = 8000

// ── Pagination ────────────────────────────────────────────────────────────────
const currentPage = ref(0)
const totalElements = ref(0)
const totalPages = ref(0)
const isLastPage = ref(true)

// ── Filters ───────────────────────────────────────────────────────────────────
const searchQuery = ref('')
const filterCohortId = ref<string | null>(null)
const filterSpecId = ref<string | null>(null)
const filterSpecOptions = ref<Specialization[]>([])
const activeTab = ref<'Active' | 'Archived'>('Active')

// ── Drawer ────────────────────────────────────────────────────────────────────
const showDrawer = ref(false)
const editTarget = ref<Learner | null>(null)
const submitting = ref(false)
const formSpecOptions = ref<Specialization[]>([])
const form = ref({
  fullName: '',
  email: '',
  cohortId: null as string | null,
  specId: null as string | null,
  status: 'ACTIVE' as LearnerStatus,
  error: '',
})

// ── Kebab ─────────────────────────────────────────────────────────────────────
const activeKebabId = ref<string | null>(null)

// ── Computed ──────────────────────────────────────────────────────────────────
const drawerTitle = computed(() => editTarget.value ? 'Edit learner' : 'Add learner')

const showingFrom = computed(() => totalElements.value === 0 ? 0 : currentPage.value * PAGE_SIZE + 1)
const showingTo = computed(() => Math.min((currentPage.value + 1) * PAGE_SIZE, totalElements.value))

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadLearners(page = currentPage.value) {
  isLoading.value = true
  loadError.value = null
  loadSlow.value = false
  const slowTimer = setTimeout(() => { loadSlow.value = true }, LOAD_TIMEOUT_MS)
  try {
    const result = await getLearners({
      cohortId: filterCohortId.value ?? undefined,
      specializationId: filterSpecId.value ?? undefined,
      status: activeTab.value === 'Active' ? 'ACTIVE' : 'ARCHIVED',
      search: searchQuery.value.trim() || undefined,
      page,
      size: PAGE_SIZE,
    })
    learners.value = result.content
    currentPage.value = result.page
    totalElements.value = result.totalElements
    totalPages.value = result.totalPages
    isLastPage.value = result.last
  } catch {
    loadError.value = 'Failed to load learners. Check your connection and try again.'
  } finally {
    clearTimeout(slowTimer)
    isLoading.value = false
    loadSlow.value = false
  }
}

async function loadInitialData() {
  try {
    const cohortsResult = await getCohorts(0, 100)
    cohortOptions.value = cohortsResult.content
  } catch {
    // cohort options failing doesn't block the table
  }
  await loadLearners(0)
}

// ── Watchers ──────────────────────────────────────────────────────────────────
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 0
    loadLearners(0)
  }, 400)
})

watch(activeTab, () => {
  currentPage.value = 0
  loadLearners(0)
})

watch(filterCohortId, async (id) => {
  filterSpecId.value = null
  filterSpecOptions.value = []
  if (id) {
    filterSpecOptions.value = await getSpecializations(id)
  }
  currentPage.value = 0
  loadLearners(0)
})

watch(filterSpecId, () => {
  currentPage.value = 0
  loadLearners(0)
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  loadInitialData()
  window.addEventListener('click', closeKebab)
})

onUnmounted(() => {
  window.removeEventListener('click', closeKebab)
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})

// ── Actions ───────────────────────────────────────────────────────────────────
function closeKebab() {
  activeKebabId.value = null
}

function toggleKebab(event: MouseEvent, id: string) {
  event.stopPropagation()
  activeKebabId.value = activeKebabId.value === id ? null : id
}

function resetForm() {
  form.value = { fullName: '', email: '', cohortId: null, specId: null, status: 'ACTIVE', error: '' }
  formSpecOptions.value = []
}

function openAdd() {
  editTarget.value = null
  resetForm()
  showDrawer.value = true
}

async function openEdit(learner: Learner) {
  activeKebabId.value = null
  editTarget.value = learner
  form.value = {
    fullName: learner.fullName,
    email: learner.email,
    cohortId: learner.cohortId,
    specId: null,
    status: learner.status,
    error: '',
  }
  formSpecOptions.value = await getSpecializations(learner.cohortId)
  form.value.specId = learner.specializationId
  showDrawer.value = true
}

function closeDrawer() {
  showDrawer.value = false
  editTarget.value = null
  resetForm()
}

async function onFormCohortChange(event: Event) {
  const val = (event.target as HTMLSelectElement).value
  form.value.cohortId = val || null
  form.value.specId = null
  formSpecOptions.value = []
  if (form.value.cohortId) {
    formSpecOptions.value = await getSpecializations(form.value.cohortId)
  }
}

async function submitForm() {
  form.value.error = ''
  if (!form.value.fullName.trim() || !form.value.email.trim()) {
    form.value.error = 'Full name and email are required.'
    return
  }
  if (!form.value.cohortId || !form.value.specId) {
    form.value.error = 'Cohort and specialization are required.'
    return
  }

  const payload = {
    fullName: form.value.fullName.trim(),
    email: form.value.email.trim(),
    cohortId: form.value.cohortId,
    specializationId: form.value.specId,
    status: form.value.status,
  }

  submitting.value = true
  try {
    if (editTarget.value) {
      const updated = await updateLearner(editTarget.value.id, payload)
      const idx = learners.value.findIndex((l) => l.id === editTarget.value!.id)
      if (idx !== -1) learners.value[idx] = updated
      toast.show({ tone: 'success', title: 'Learner updated' })
    } else {
      await addLearner(payload)
      toast.show({ tone: 'success', title: 'Learner added' })
      loadLearners(0)
    }
    closeDrawer()
  } catch {
    form.value.error = 'Something went wrong. Please try again.'
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(learner: Learner) {
  activeKebabId.value = null
  const newStatus: LearnerStatus = learner.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'
  try {
    await setLearnerStatus(learner.id, newStatus)
    loadLearners(currentPage.value)
    toast.show({ tone: 'success', title: newStatus === 'ARCHIVED' ? 'Learner archived' : 'Learner restored' })
  } catch {
    toast.show({ tone: 'warning', title: 'Failed to update status' })
  }
}

function goToPage(page: number) {
  if (page < 0 || page >= totalPages.value) return
  loadLearners(page)
}
</script>

<template>
  <!-- Page header -->
  <div class="page-head">
    <h1 class="page-title">Learner roster</h1>
    <div style="display: flex; gap: 12px">
      <VButton variant="ghost" icon="user-plus" @click="openAdd">Add learner</VButton>
      <VButton
        variant="primary"
        icon="upload"
        @click="toast.show({ tone: 'info', title: 'CSV import coming soon', body: 'This will be available once the bulk-upload endpoint is live.' })"
      >
        Import CSV
      </VButton>
    </div>
  </div>

  <!-- Slow-connection warning -->
  <div v-if="loadSlow && isLoading" class="load-slow-banner">
    <VIcon name="clock" :size="15" />
    This is taking longer than expected…
  </div>

  <!-- Error state -->
  <div v-else-if="loadError && !isLoading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load learners</p>
    <p class="load-error-sub">{{ loadError }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="loadLearners(0)">Try again</VButton>
  </div>

  <div v-else class="card" style="overflow: hidden">
    <!-- Toolbar -->
    <div class="toolbar">
      <!-- Email search -->
      <div class="search" style="flex: 1; min-width: 200px">
        <VIcon name="search" :size="17" style="color: var(--text-secondary)" />
        <input v-model="searchQuery" type="email" placeholder="Search by email…" />
      </div>

      <!-- Cohort filter -->
      <div style="position: relative; display: inline-flex; align-items: center">
        <select
          class="selectf-btn"
          style="appearance: none; -webkit-appearance: none; padding-right: 36px; cursor: pointer; width: 170px"
          @change="filterCohortId = ($event.target as HTMLSelectElement).value || null"
        >
          <option value="">All Cohorts</option>
          <option v-for="c in cohortOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <VIcon name="chevron-down" :size="16" style="position: absolute; right: 12px; pointer-events: none; color: var(--text-secondary)" />
      </div>

      <!-- Spec filter -->
      <div style="position: relative; display: inline-flex; align-items: center">
        <select
          class="selectf-btn"
          style="appearance: none; -webkit-appearance: none; padding-right: 36px; cursor: pointer; width: 200px"
          :disabled="!filterCohortId"
          @change="filterSpecId = ($event.target as HTMLSelectElement).value || null"
        >
          <option value="">{{ filterCohortId ? 'All Specializations' : 'Select cohort first' }}</option>
          <option v-for="s in filterSpecOptions" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <VIcon name="chevron-down" :size="16" style="position: absolute; right: 12px; pointer-events: none; color: var(--text-secondary)" />
      </div>

      <!-- Active / Archived toggle -->
      <div class="segtoggle">
        <button
          v-for="tab in ['Active', 'Archived']"
          :key="tab"
          :class="['segtoggle-btn', { on: activeTab === tab }]"
          @click="activeTab = tab as 'Active' | 'Archived'"
        >
          {{ tab }}
        </button>
      </div>
    </div>

    <!-- Table -->
    <table class="tbl">
      <thead>
        <tr>
          <th style="width: 44px"><input type="checkbox" /></th>
          <th>Full name</th>
          <th>Email</th>
          <th>Cohort</th>
          <th>Specialization</th>
          <th>Status</th>
          <th style="text-align: right">Actions</th>
        </tr>
      </thead>
      <tbody v-if="isLoading">
        <tr v-for="i in 6" :key="i" class="skel-row">
          <td><span class="skel" style="width: 16px; display: inline-block" /></td>
          <td><span class="skel" style="width: 55%" /></td>
          <td><span class="skel mono" style="width: 65%" /></td>
          <td><span class="skel" style="width: 70%" /></td>
          <td><span class="skel" style="width: 80%" /></td>
          <td><span class="skel" style="width: 60px; border-radius: 999px; display: inline-block" /></td>
          <td style="text-align: right"><span class="skel" style="width: 32px; display: inline-block" /></td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-if="!learners.length">
          <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 32px">
            No learners found.
          </td>
        </tr>
        <tr v-for="l in learners" :key="l.id">
          <td><input type="checkbox" /></td>
          <td style="font-weight: 600">{{ l.fullName }}</td>
          <td class="mono" style="color: var(--text-secondary)">{{ l.email }}</td>
          <td>{{ l.cohortName }}</td>
          <td>{{ l.specializationName }}</td>
          <td>
            <VPill :tone="l.status === 'ACTIVE' ? 'success' : 'danger'">
              {{ l.status === 'ACTIVE' ? 'Active' : 'Archived' }}
            </VPill>
          </td>
          <td style="text-align: right; position: relative">
            <button class="kebab" aria-label="Actions" @click="toggleKebab($event, l.id)">
              <VIcon name="more-vertical" :size="18" />
            </button>
            <div
              v-if="activeKebabId === l.id"
              style="position: absolute; right: 0; top: 36px; z-index: 20; background: #fff; border: 1px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow-pop); min-width: 160px; overflow: hidden"
              @click.stop
            >
              <button
                style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 16px; border: none; background: none; font-family: inherit; font-size: 14px; color: var(--text); cursor: pointer; text-align: left"
                @mouseenter="($event.target as HTMLElement).style.background = 'var(--bg)'"
                @mouseleave="($event.target as HTMLElement).style.background = 'none'"
                @click="openEdit(l)"
              >
                <VIcon name="pencil" :size="15" style="color: var(--text-secondary)" />
                Edit
              </button>
              <button
                style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 16px; border: none; background: none; font-family: inherit; font-size: 14px; color: var(--text); cursor: pointer; text-align: left"
                @mouseenter="($event.target as HTMLElement).style.background = 'var(--bg)'"
                @mouseleave="($event.target as HTMLElement).style.background = 'none'"
                @click="toggleStatus(l)"
              >
                <VIcon :name="l.status === 'ACTIVE' ? 'archive' : 'rotate-ccw'" :size="15" style="color: var(--text-secondary)" />
                {{ l.status === 'ACTIVE' ? 'Archive' : 'Restore' }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div v-if="!isLoading && totalElements > 0" class="pager">
      <span class="pager-count">
        Showing {{ showingFrom }} to {{ showingTo }} of {{ totalElements }} entries
      </span>
      <div class="pager-ctrls">
        <button class="pg-arrow" aria-label="Previous" :disabled="currentPage === 0" @click="goToPage(currentPage - 1)">
          <VIcon name="chevron-left" :size="16" />
        </button>
        <button
          v-for="p in totalPages"
          :key="p"
          :class="['pg-num', { on: currentPage === p - 1 }]"
          @click="goToPage(p - 1)"
        >
          {{ p }}
        </button>
        <button class="pg-arrow" aria-label="Next" :disabled="isLastPage" @click="goToPage(currentPage + 1)">
          <VIcon name="chevron-right" :size="16" />
        </button>
      </div>
    </div>
  </div>

  <!-- Add / Edit Drawer -->
  <VDrawer
    :open="showDrawer"
    :title="drawerTitle"
    subtitle="Learners are reference records used for validation lookups."
    @close="closeDrawer"
  >
    <label class="ff">
      <span class="ff-label">Full name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="form.fullName" placeholder="e.g. Abena Mensah" />
      </span>
    </label>
    <label class="ff">
      <span class="ff-label">Email <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="form.email" class="mono" type="email" placeholder="name@example.com" />
      </span>
      <span class="ff-hint">Canonical identifier — matched case-insensitively in CSVs.</span>
    </label>
    <div class="ff-row">
      <label class="ff">
        <span class="ff-label">Cohort <span style="color: var(--danger)">*</span></span>
        <div style="position: relative; display: flex; align-items: center">
          <select
            :value="form.cohortId ?? ''"
            class="ff-input"
            style="appearance: none; -webkit-appearance: none; width: 100%; padding-right: 36px; cursor: pointer"
            @change="onFormCohortChange"
          >
            <option value="">Select cohort…</option>
            <option v-for="c in cohortOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <VIcon name="chevron-down" :size="16" style="position: absolute; right: 12px; pointer-events: none; color: var(--text-secondary)" />
        </div>
      </label>
      <label class="ff">
        <span class="ff-label">Specialization <span style="color: var(--danger)">*</span></span>
        <div style="position: relative; display: flex; align-items: center">
          <select
            :value="form.specId ?? ''"
            class="ff-input"
            style="appearance: none; -webkit-appearance: none; width: 100%; padding-right: 36px; cursor: pointer"
            :disabled="!form.cohortId || !formSpecOptions.length"
            @change="form.specId = ($event.target as HTMLSelectElement).value || null"
          >
            <option value="">{{ form.cohortId ? 'Select specialization…' : 'Select cohort first' }}</option>
            <option v-for="s in formSpecOptions" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <VIcon name="chevron-down" :size="16" style="position: absolute; right: 12px; pointer-events: none; color: var(--text-secondary)" />
        </div>
      </label>
    </div>
    <label class="ff">
      <span class="ff-label">Status</span>
      <div style="position: relative; display: flex; align-items: center">
        <select
          v-model="form.status"
          class="ff-input"
          style="appearance: none; -webkit-appearance: none; width: 100%; padding-right: 36px; cursor: pointer"
        >
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <VIcon name="chevron-down" :size="16" style="position: absolute; right: 12px; pointer-events: none; color: var(--text-secondary)" />
      </div>
    </label>
    <p v-if="form.error" class="field-error">
      <VIcon name="alert-circle" :size="14" />{{ form.error }}
    </p>
    <template #footer>
      <VButton variant="ghost" @click="closeDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitForm">
        {{ editTarget ? 'Save changes' : 'Add learner' }}
      </VButton>
    </template>
  </VDrawer>
</template>
