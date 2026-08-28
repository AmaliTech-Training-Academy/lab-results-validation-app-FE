<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import VTablePager from '@/components/base/VTablePager.vue'
import VRowActions from '@/components/base/VRowActions.vue'
import VPopover from '@/components/base/VPopover.vue'
import VEmptyState from '@/components/base/VEmptyState.vue'
import { useToastStore } from '@/stores/toast'
import { toErrorMessage } from '@/utils/errors'
import { getLearners, addLearner, updateLearner, setLearnerStatus } from '@/services/learner.service'
import { getCohorts } from '@/services/cohort.service'
import { getSpecializations } from '@/services/reference.service'
import { useQueryParam } from '@/composables/useQueryParam'
import { usePageTitle } from '@/composables/usePageTitle'
import { loadColumns, saveColumns, loadPageSize, savePageSize } from '@/utils/uiPrefs'
import { PAGE_SIZE_OPTIONS } from '@/utils/pagination'
import type { Learner, LearnerStatus } from '@/types/learner.types'
import type { CohortRow } from '@/types/cohort.types'
import type { Specialization } from '@/types/reference.types'

usePageTitle('Learner roster')

const router = useRouter()

const toast = useToastStore()

// ── Data ─────────────────────────────────────────────────────────────────────
const learners = ref<Learner[]>([])
const cohortOptions = ref<CohortRow[]>([])
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadSlow = ref(false)
const LOAD_TIMEOUT_MS = 8000

// ── Pagination ────────────────────────────────────────────────────────────────
// `currentPage` is 1-based (URL/VTablePager convention) — the backend's `page`/`size`
// query params are 0-based, so requests/responses convert at the loadLearners boundary.
const currentPage = ref(1)
const totalElements = ref(0)
const PAGESIZE_KEY = 'validata.learners.pageSize'
const pageSize = ref(loadPageSize(PAGESIZE_KEY, 10, PAGE_SIZE_OPTIONS))
watch(pageSize, (v) => savePageSize(PAGESIZE_KEY, v))

// ── Filters ───────────────────────────────────────────────────────────────────
const searchQuery = ref('')
const filterCohortId = ref<string | null>(null)
const filterSpecId = ref<string | null>(null)
const filterSpecOptions = ref<Specialization[]>([])
const activeTab = ref<'Active' | 'Archived'>('Active')

// Table state lives in the URL (q/page) so filters survive reloads and filtered
// views can be shared as links.
function parseSearch(raw: string | undefined): string {
  return raw ?? ''
}
function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}
useQueryParam({ key: 'q', target: searchQuery, parse: parseSearch, encode: (v) => v.trim() || null })
useQueryParam({ key: 'page', target: currentPage, parse: parsePage, encode: (v) => (v > 1 ? String(v) : null) })

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

// ── Manage columns ─────────────────────────────────────────────────────────
const COLS_KEY = 'validata.learners.columns'
const cols = ref(loadColumns(COLS_KEY, { email: true, cohort: true, spec: true, status: true }))
watch(cols, (v) => saveColumns(COLS_KEY, v), { deep: true })
const COL_LABELS: { key: keyof typeof cols.value; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'cohort', label: 'Cohort' },
  { key: 'spec', label: 'Specialization' },
  { key: 'status', label: 'Status' },
]
const colCount = computed(() => 1 + Object.values(cols.value).filter(Boolean).length + 1)
const showColMenu = ref(false)
const colMenuAnchor = ref<HTMLElement | null>(null)
function toggleColMenu(event: MouseEvent) {
  event.stopPropagation()
  activeKebabId.value = null
  showColMenu.value = !showColMenu.value
  if (showColMenu.value) colMenuAnchor.value = event.currentTarget as HTMLElement
}

// ── Export (fetches the full filtered set, not just the current page) ───────
const exporting = ref(false)
function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
async function exportCsv() {
  showColMenu.value = false
  exporting.value = true
  try {
    const all = await getLearners({
      cohortId: filterCohortId.value ?? undefined,
      specializationId: filterSpecId.value ?? undefined,
      status: activeTab.value === 'Active' ? 'ACTIVE' : 'ARCHIVED',
      search: searchQuery.value.trim() || undefined,
      page: 0,
      size: 1000,
    })
    const header = ['Full name', 'Email', 'Cohort', 'Specialization', 'Status']
    const body = all.content.map((l) =>
      [l.fullName, l.email, l.cohortName ?? '', l.specializationName ?? '', l.status === 'ACTIVE' ? 'Active' : 'Archived']
        .map(csvCell)
        .join(','),
    )
    const csv = [header.map(csvCell).join(','), ...body].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'learners.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.show({ tone: 'success', title: 'Export ready', body: `${all.content.length} learner${all.content.length === 1 ? '' : 's'} exported to CSV.` })
  } catch (e) {
    toast.show({ tone: 'warning', title: 'Export failed', body: toErrorMessage(e, 'Could not export learners.') })
  } finally {
    exporting.value = false
  }
}

// ── Computed ──────────────────────────────────────────────────────────────────
const drawerTitle = computed(() => editTarget.value ? 'Edit learner' : 'Add learner')

// ── Data loading ──────────────────────────────────────────────────────────────
// `page` here is 1-based (URL/VTablePager convention); the backend's own `page`
// param is 0-based, so it's converted at the request/response boundary.
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
      page: page - 1,
      size: pageSize.value,
    })
    learners.value = result.content
    currentPage.value = result.page + 1
    totalElements.value = result.totalElements
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    loadError.value = msg || 'Failed to load learners. Check your connection and try again.'
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
  } catch (e) {
    // Cohort options failing doesn't block the table, but it should be visible — an empty filter
    // dropdown is confusing without a reason.
    toast.show({
      tone: 'warning',
      title: 'Could not load cohorts',
      body: e instanceof Error ? e.message : 'The cohort filter is unavailable.',
    })
  }
  await loadLearners(currentPage.value)
}

// ── Watchers ──────────────────────────────────────────────────────────────────
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadLearners(1)
  }, 400)
})

watch(activeTab, () => {
  currentPage.value = 1
  loadLearners(1)
})

watch(filterCohortId, async (id) => {
  filterSpecId.value = null
  filterSpecOptions.value = []
  if (id) {
    try {
      filterSpecOptions.value = (await getSpecializations(id)).content
    } catch (e) {
      toast.show({ tone: 'warning', title: 'Could not load specializations', body: toErrorMessage(e, 'Please try again.') })
    }
  }
  currentPage.value = 1
  loadLearners(1)
})

watch(filterSpecId, () => {
  currentPage.value = 1
  loadLearners(1)
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  loadInitialData()
})

onUnmounted(() => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
})

// ── Actions ───────────────────────────────────────────────────────────────────
function onKebabToggle(payload: { id: string; anchor: HTMLElement }) {
  showColMenu.value = false
  activeKebabId.value = payload.id
}

function onKebabClose() {
  activeKebabId.value = null
}

function onPageSizeChange(size: number) {
  pageSize.value = size
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
  try {
    formSpecOptions.value = (await getSpecializations(learner.cohortId)).content
  } catch (e) {
    toast.show({ tone: 'warning', title: 'Could not load specializations', body: toErrorMessage(e, 'Please try again.') })
  }
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
    try {
      formSpecOptions.value = (await getSpecializations(form.value.cohortId)).content
    } catch (e) {
      toast.show({ tone: 'warning', title: 'Could not load specializations', body: toErrorMessage(e, 'Please try again.') })
    }
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
      currentPage.value = 1
      loadLearners(1)
    }
    closeDrawer()
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('locked')) {
      closeDrawer()
      toast.show({ tone: 'warning', title: 'Cohort is locked', body: 'Unlock the cohort before making changes.' })
    } else {
      const msg = err instanceof Error ? err.message : ''
      form.value.error = msg || 'Something went wrong. Please try again.'
    }
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
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('locked')) {
      toast.show({ tone: 'warning', title: 'Cohort is locked', body: 'Unlock the cohort before making changes.' })
    } else {
      const msg = err instanceof Error ? err.message : ''
      toast.show({ tone: 'warning', title: 'Failed to update status', body: msg || undefined })
    }
  }
}

function onPageChange(page: number) {
  loadLearners(page)
}
</script>

<template>
  <!-- Page header -->
  <div class="page-head">
    <div>
      <div class="crumbs" style="margin-bottom: 6px">
        <span>Admin</span>
        <VIcon name="chevron-right" :size="14" />
        <span class="cur">Learner roster</span>
      </div>
      <h1 class="page-title">Learner roster</h1>
    </div>
    <div style="display: flex; gap: 12px">
      <VButton variant="ghost" icon="upload" @click="router.push({ name: 'admin-learners-bulk' })">
        Bulk setup
      </VButton>
      <VButton variant="primary" icon="user-plus" @click="openAdd">Add learner</VButton>
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
    <VButton variant="ghost" icon="rotate-ccw" @click="loadLearners(1)">Try again</VButton>
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

      <!-- Column + export actions -->
      <div style="margin-left: auto; display: flex; align-items: center; gap: 10px">
        <VButton size="sm" variant="ghost" icon="columns-3" @click="toggleColMenu">Manage columns</VButton>
        <VButton size="sm" variant="primary" icon="download" :disabled="exporting" @click="exportCsv">Export</VButton>
      </div>
    </div>

    <!-- Table -->
    <table class="tbl">
      <thead>
        <tr>
          <th>Full name</th>
          <th v-if="cols.email">Email</th>
          <th v-if="cols.cohort">Cohort</th>
          <th v-if="cols.spec">Specialization</th>
          <th v-if="cols.status">Status</th>
          <th style="text-align: right">Actions</th>
        </tr>
      </thead>
      <tbody v-if="isLoading">
        <tr v-for="i in 6" :key="i" class="skel-row">
          <td><span class="skel" style="width: 55%" /></td>
          <td v-if="cols.email"><span class="skel mono" style="width: 65%" /></td>
          <td v-if="cols.cohort"><span class="skel" style="width: 70%" /></td>
          <td v-if="cols.spec"><span class="skel" style="width: 80%" /></td>
          <td v-if="cols.status"><span class="skel" style="width: 60px; border-radius: 999px; display: inline-block" /></td>
          <td style="text-align: right"><span class="skel" style="width: 32px; display: inline-block" /></td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-if="!learners.length">
          <td :colspan="colCount">
            <VEmptyState
              icon="users"
              title="No learners found"
              description="Add learners individually, bulk-import a roster, or adjust your search and filters."
            />
          </td>
        </tr>
        <tr v-for="l in learners" :key="l.id">
          <td style="font-weight: 600">{{ l.fullName }}</td>
          <td v-if="cols.email" class="mono" style="color: var(--text-secondary)">{{ l.email }}</td>
          <td v-if="cols.cohort">{{ l.cohortName }}</td>
          <td v-if="cols.spec">{{ l.specializationName }}</td>
          <td v-if="cols.status">
            <VPill :tone="l.status === 'ACTIVE' ? 'success' : 'danger'" style="display: inline-flex; align-items: center; gap: 6px">
              {{ l.status === 'ACTIVE' ? 'Active' : 'Archived' }}
            </VPill>
          </td>
          <td style="text-align: right">
            <VRowActions :active-id="activeKebabId" :row-id="l.id" @toggle="onKebabToggle" @close="onKebabClose">
              <button class="pop-item" @click="openEdit(l)">
                <VIcon name="pencil" :size="15" />
                Edit
              </button>
              <button class="pop-item" @click="toggleStatus(l)">
                <VIcon :name="l.status === 'ACTIVE' ? 'archive' : 'rotate-ccw'" :size="15" />
                {{ l.status === 'ACTIVE' ? 'Archive' : 'Restore' }}
              </button>
            </VRowActions>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <VTablePager
      v-if="!isLoading && totalElements > 0"
      :total="totalElements"
      :page="currentPage"
      :page-size="pageSize"
      @update:page="onPageChange"
      @update:page-size="onPageSizeChange"
    />
  </div>

  <!-- Add / Edit Drawer -->
  <VDrawer
    :open="showDrawer"
    :title="drawerTitle"
    subtitle="Learners are reference records used for validation lookups."
    :error="form.error || undefined"
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
    <template #footer>
      <VButton variant="ghost" @click="closeDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitForm">
        {{ editTarget ? 'Save changes' : 'Add learner' }}
      </VButton>
    </template>
  </VDrawer>

  <!-- Manage columns popover -->
  <VPopover :open="showColMenu" :anchor="colMenuAnchor" @close="showColMenu = false">
    <p class="pop-title">Manage columns</p>
    <label v-for="c in COL_LABELS" :key="c.key" class="pop-row">
      <input type="checkbox" v-model="cols[c.key]" />
      {{ c.label }}
    </label>
  </VPopover>
</template>
