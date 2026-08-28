<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VEmptyState from '@/components/base/VEmptyState.vue'
import VIcon from '@/components/base/VIcon.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import VModal from '@/components/base/VModal.vue'
import VTablePager from '@/components/base/VTablePager.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { useToastStore } from '@/stores/toast'
import {
  getSpecializations,
  getModules,
  getLabs,
  addSpecialization,
  updateSpecialization,
  addModule,
  updateModule,
  addLab,
  updateLab,
  forceEditLab,
} from '@/services/reference.service'
import { getCohorts } from '@/services/cohort.service'
import { PAGE_SIZE_OPTIONS } from '@/utils/pagination'
import { loadPageSize, savePageSize } from '@/utils/uiPrefs'
import type { Specialization, Module, Lab } from '@/types/reference.types'
import type { CohortRow } from '@/types/cohort.types'

usePageTitle('Reference data')

const toast = useToastStore()
const route = useRoute()

// ── Data ────────────────────────────────────────────────────────────────────
const cohorts = ref<CohortRow[]>([])
const specializations = ref<Specialization[]>([])
const modules = ref<Module[]>([])
const labs = ref<Lab[]>([])

// ── Selection ────────────────────────────────────────────────────────────────
const selectedCohortId = ref<string | null>(null)
const selectedSpecId = ref<string | null>(null)
const selectedModId = ref<string | null>(null)

// ── Loading ──────────────────────────────────────────────────────────────────
const loading = ref({ specs: false, mods: false, labs: false })
const cohortError = ref<string | null>(null)
const loadErrors = ref({ specs: null as string | null, mods: null as string | null, labs: null as string | null })
const submitting = ref(false)

// ── Pagination ────────────────────────────────────────────────────────────────
const SPEC_PAGE_SIZE_KEY = 'validata.referenceData.specializationsPageSize'
const MOD_PAGE_SIZE_KEY = 'validata.referenceData.modulesPageSize'
const LAB_PAGE_SIZE_KEY = 'validata.referenceData.labsPageSize'

const specPageSize = ref(loadPageSize(SPEC_PAGE_SIZE_KEY, 10, PAGE_SIZE_OPTIONS))
const modPageSize = ref(loadPageSize(MOD_PAGE_SIZE_KEY, 10, PAGE_SIZE_OPTIONS))
const labPageSize = ref(loadPageSize(LAB_PAGE_SIZE_KEY, 10, PAGE_SIZE_OPTIONS))
watch(specPageSize, (v) => savePageSize(SPEC_PAGE_SIZE_KEY, v))
watch(modPageSize, (v) => savePageSize(MOD_PAGE_SIZE_KEY, v))
watch(labPageSize, (v) => savePageSize(LAB_PAGE_SIZE_KEY, v))

const specPage = ref(0)
const specTotalPages = ref(0)
const specTotalElements = ref(0)
const specIsLastPage = ref(true)

const modPage = ref(0)
const modTotalPages = ref(0)
const modTotalElements = ref(0)
const modIsLastPage = ref(true)

const labPage = ref(0)
const labTotalPages = ref(0)
const labTotalElements = ref(0)
const labIsLastPage = ref(true)

// ── Drawer / Modal visibility ────────────────────────────────────────────────
const showAddSpecDrawer = ref(false)
const showAddModDrawer = ref(false)
const showAddLabDrawer = ref(false)
const editTarget = ref<Lab | null>(null)
const forceEditTarget = ref<Lab | null>(null)
const editSpecTarget = ref<Specialization | null>(null)
const editModTarget = ref<Module | null>(null)

// ── Forms ────────────────────────────────────────────────────────────────────
const addSpecForm = ref({ name: '', code: '', error: '' })
const addModForm = ref({ name: '', error: '' })
const addLabForm = ref({ title: '', maxScore: '', error: '' })
const editLabForm = ref({ title: '', maxScore: '', error: '' })
const forceEditForm = ref({ maxScore: '', reason: '', error: '' })
const editSpecForm = ref({ name: '', code: '', error: '' })
const editModForm = ref({ name: '', status: 'ACTIVE', error: '' })

// ── Computed ─────────────────────────────────────────────────────────────────
const selectedSpec = computed(() =>
  specializations.value.find((s) => s.id === selectedSpecId.value) ?? null,
)
const selectedCohort = computed(() =>
  cohorts.value.find((c) => c.id === selectedCohortId.value) ?? null,
)

// ── Fetch helpers (also used by retry buttons) ────────────────────────────────
async function fetchSpecs(id: string, page = 0) {
  loading.value.specs = true
  loadErrors.value.specs = null
  try {
    const result = await getSpecializations(id, page, specPageSize.value)
    specializations.value = result.content
    specPage.value = result.page
    specTotalPages.value = result.totalPages
    specTotalElements.value = result.totalElements
    specIsLastPage.value = result.last
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    loadErrors.value.specs = msg || 'Failed to load specializations.'
  } finally {
    loading.value.specs = false
  }
}

async function fetchMods(specId: string, page = 0) {
  loading.value.mods = true
  loadErrors.value.mods = null
  try {
    const result = await getModules(specId, page, modPageSize.value)
    modules.value = result.content
    modPage.value = result.page
    modTotalPages.value = result.totalPages
    modTotalElements.value = result.totalElements
    modIsLastPage.value = result.last
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    loadErrors.value.mods = msg || 'Failed to load modules.'
  } finally {
    loading.value.mods = false
  }
}

async function fetchLabs(id: string, page = 0) {
  loading.value.labs = true
  loadErrors.value.labs = null
  try {
    const result = await getLabs(id, page, labPageSize.value)
    labs.value = result.content
    labPage.value = result.page
    labTotalPages.value = result.totalPages
    labTotalElements.value = result.totalElements
    labIsLastPage.value = result.last
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    loadErrors.value.labs = msg || 'Failed to load labs.'
  } finally {
    loading.value.labs = false
  }
}

// ── Watchers ─────────────────────────────────────────────────────────────────
watch(selectedCohortId, async (id) => {
  specializations.value = []
  modules.value = []
  labs.value = []
  selectedSpecId.value = null
  selectedModId.value = null
  loadErrors.value = { specs: null, mods: null, labs: null }
  specPage.value = 0
  modPage.value = 0
  labPage.value = 0
  if (id === null) return
  await fetchSpecs(id, 0)
})

watch(selectedSpecId, async (specId) => {
  modules.value = []
  labs.value = []
  selectedModId.value = null
  loadErrors.value.mods = null
  loadErrors.value.labs = null
  modPage.value = 0
  labPage.value = 0
  if (specId === null) return
  await fetchMods(specId, 0)
})

watch(selectedModId, async (id) => {
  labs.value = []
  loadErrors.value.labs = null
  labPage.value = 0
  if (id === null) return
  await fetchLabs(id, 0)
})

// ── Mount ────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const result = await getCohorts(0, 100)
    cohorts.value = result.content
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    cohortError.value = msg || 'Failed to load cohorts. Please try again.'
    return
  }
  const queryCohortId = route.query.cohortId as string | undefined
  if (queryCohortId && cohorts.value.some((c) => c.id === queryCohortId)) {
    selectedCohortId.value = queryCohortId
  } else if (cohorts.value.length > 0) {
    selectedCohortId.value = cohorts.value[0]!.id
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function isCohortLockedError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('locked')
}

// ── Actions ──────────────────────────────────────────────────────────────────
function selectSpec(id: string) {
  selectedSpecId.value = id
}

function selectMod(id: string) {
  selectedModId.value = id
}

function closeAddSpecDrawer() {
  showAddSpecDrawer.value = false
  addSpecForm.value = { name: '', code: '', error: '' }
}

function closeAddModDrawer() {
  showAddModDrawer.value = false
  addModForm.value = { name: '', error: '' }
}

function closeAddLabDrawer() {
  showAddLabDrawer.value = false
  addLabForm.value = { title: '', maxScore: '', error: '' }
}

function openEditSpec(spec: Specialization) {
  editSpecTarget.value = spec
  editSpecForm.value = { name: spec.name, code: spec.code, error: '' }
}

function closeEditSpec() {
  editSpecTarget.value = null
  editSpecForm.value = { name: '', code: '', error: '' }
}

function openEditMod(mod: Module) {
  editModTarget.value = mod
  editModForm.value = { name: mod.name, status: mod.status, error: '' }
}

function closeEditMod() {
  editModTarget.value = null
  editModForm.value = { name: '', status: 'ACTIVE', error: '' }
}

function openEditLab(lab: Lab) {
  editTarget.value = lab
  editLabForm.value = { title: lab.title, maxScore: String(lab.maxScore), error: '' }
}

function closeEditLab() {
  editTarget.value = null
  editLabForm.value = { title: '', maxScore: '', error: '' }
}

function openForceEdit(lab: Lab) {
  forceEditTarget.value = lab
  forceEditForm.value = { maxScore: String(lab.maxScore), reason: '', error: '' }
}

function closeForceEdit() {
  forceEditTarget.value = null
  forceEditForm.value = { maxScore: '', reason: '', error: '' }
}

async function submitAddSpec() {
  addSpecForm.value.error = ''
  if (!addSpecForm.value.name.trim() || !addSpecForm.value.code.trim()) {
    addSpecForm.value.error = 'Name and code are required.'
    return
  }
  submitting.value = true
  try {
    const spec = await addSpecialization(
      selectedCohortId.value!,
      addSpecForm.value.name.trim(),
      addSpecForm.value.code.trim(),
    )
    specializations.value.push(spec)
    closeAddSpecDrawer()
    toast.show({ tone: 'success', title: 'Specialization added' })
  } catch (err) {
    if (isCohortLockedError(err)) {
      closeAddSpecDrawer()
      toast.show({ tone: 'warning', title: 'Cohort is locked', body: 'Unlock the cohort before making changes.' })
    } else {
      const msg = err instanceof Error ? err.message : ''
      addSpecForm.value.error = msg || 'Failed to add specialization. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}

async function submitAddMod() {
  addModForm.value.error = ''
  if (!addModForm.value.name.trim()) {
    addModForm.value.error = 'Module name is required.'
    return
  }
  submitting.value = true
  try {
    const mod = await addModule(
      selectedCohortId.value!,
      selectedSpecId.value!,
      addModForm.value.name.trim(),
    )
    modules.value.push(mod)
    closeAddModDrawer()
    toast.show({ tone: 'success', title: 'Module added' })
  } catch (err) {
    if (isCohortLockedError(err)) {
      closeAddModDrawer()
      toast.show({ tone: 'warning', title: 'Cohort is locked', body: 'Unlock the cohort before making changes.' })
    } else {
      const msg = err instanceof Error ? err.message : ''
      addModForm.value.error = msg || 'Failed to add module. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}

async function submitAddLab() {
  addLabForm.value.error = ''
  const max = Number(addLabForm.value.maxScore)
  if (!addLabForm.value.title.trim()) {
    addLabForm.value.error = 'Lab title is required.'
    return
  }
  if (!addLabForm.value.maxScore || isNaN(max) || max <= 0) {
    addLabForm.value.error = 'Max score must be a positive number.'
    return
  }
  submitting.value = true
  try {
    const lab = await addLab({
      moduleId: selectedModId.value!,
      title: addLabForm.value.title.trim(),
      maxScore: max,
    })
    labs.value.push(lab)
    closeAddLabDrawer()
    toast.show({ tone: 'success', title: 'Lab added' })
  } catch (err) {
    if (isCohortLockedError(err)) {
      closeAddLabDrawer()
      toast.show({ tone: 'warning', title: 'Cohort is locked', body: 'Unlock the cohort before making changes.' })
    } else {
      const msg = err instanceof Error ? err.message : ''
      addLabForm.value.error = msg || 'Failed to add lab. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}

async function submitEditSpec() {
  editSpecForm.value.error = ''
  if (!editSpecForm.value.name.trim() || !editSpecForm.value.code.trim()) {
    editSpecForm.value.error = 'Name and code are required.'
    return
  }
  submitting.value = true
  try {
    const updated = await updateSpecialization(
      editSpecTarget.value!.id,
      editSpecForm.value.name.trim(),
      editSpecForm.value.code.trim(),
    )
    const idx = specializations.value.findIndex((s) => s.id === editSpecTarget.value!.id)
    if (idx !== -1) specializations.value[idx] = updated
    closeEditSpec()
    toast.show({ tone: 'success', title: 'Specialization updated' })
  } catch (err) {
    if (isCohortLockedError(err)) {
      closeEditSpec()
      toast.show({ tone: 'warning', title: 'Cohort is locked', body: 'Unlock the cohort before making changes.' })
    } else {
      const msg = err instanceof Error ? err.message : ''
      editSpecForm.value.error = msg || 'Failed to update specialization. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}

async function submitEditMod() {
  editModForm.value.error = ''
  if (!editModForm.value.name.trim()) {
    editModForm.value.error = 'Module name is required.'
    return
  }
  submitting.value = true
  try {
    const updated = await updateModule(
      editModTarget.value!.id,
      editModForm.value.name.trim(),
      editModForm.value.status,
    )
    const idx = modules.value.findIndex((m) => m.id === editModTarget.value!.id)
    if (idx !== -1) modules.value[idx] = updated
    closeEditMod()
    toast.show({ tone: 'success', title: 'Module updated' })
  } catch (err) {
    if (isCohortLockedError(err)) {
      closeEditMod()
      toast.show({ tone: 'warning', title: 'Cohort is locked', body: 'Unlock the cohort before making changes.' })
    } else {
      const msg = err instanceof Error ? err.message : ''
      editModForm.value.error = msg || 'Failed to update module. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}

async function submitEditLab() {
  editLabForm.value.error = ''
  const max = Number(editLabForm.value.maxScore)
  if (!editLabForm.value.title.trim()) {
    editLabForm.value.error = 'Lab title is required.'
    return
  }
  if (!editLabForm.value.maxScore || isNaN(max) || max <= 0) {
    editLabForm.value.error = 'Max score must be a positive number.'
    return
  }
  submitting.value = true
  try {
    await updateLab({ labId: editTarget.value!.id, title: editLabForm.value.title.trim(), maxScore: max })
    const idx = labs.value.findIndex((l) => l.id === editTarget.value!.id)
    if (idx !== -1) {
      labs.value[idx]!.title = editLabForm.value.title.trim()
      labs.value[idx]!.maxScore = max
    }
    closeEditLab()
    toast.show({ tone: 'success', title: 'Lab updated' })
  } catch (err) {
    if (isCohortLockedError(err)) {
      closeEditLab()
      toast.show({ tone: 'warning', title: 'Cohort is locked', body: 'Unlock the cohort before making changes.' })
    } else {
      const msg = err instanceof Error ? err.message : ''
      editLabForm.value.error = msg || 'Failed to update lab. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}

function goToSpecPage(page: number) {
  if (selectedCohortId.value) fetchSpecs(selectedCohortId.value, page)
}

function goToModPage(page: number) {
  if (selectedSpecId.value) fetchMods(selectedSpecId.value, page)
}

function goToLabPage(page: number) {
  if (selectedModId.value) fetchLabs(selectedModId.value, page)
}

function onSpecPageSizeChange(size: number) {
  specPageSize.value = size
}

function onModPageSizeChange(size: number) {
  modPageSize.value = size
}

function onLabPageSizeChange(size: number) {
  labPageSize.value = size
}

async function submitForceEdit() {
  forceEditForm.value.error = ''
  const max = Number(forceEditForm.value.maxScore)
  if (isNaN(max) || max <= 0) {
    forceEditForm.value.error = 'A valid max score is required.'
    return
  }
  if (!forceEditForm.value.reason.trim()) {
    forceEditForm.value.error = 'Reason is required.'
    return
  }
  submitting.value = true
  try {
    await forceEditLab({
      labId: forceEditTarget.value!.id,
      maxScore: max,
      reason: forceEditForm.value.reason.trim(),
    })
    const idx = labs.value.findIndex((l) => l.id === forceEditTarget.value!.id)
    if (idx !== -1) labs.value[idx]!.maxScore = max
    closeForceEdit()
    toast.show({ tone: 'success', title: 'Lab updated', body: 'Change recorded in audit trail.' })
  } catch (err) {
    if (isCohortLockedError(err)) {
      closeForceEdit()
      toast.show({ tone: 'warning', title: 'Cohort is locked', body: 'Unlock the cohort before making changes.' })
    } else {
      const msg = err instanceof Error ? err.message : ''
      forceEditForm.value.error = msg || 'Failed to apply force-edit. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- Page header -->
  <div class="page-head">
    <div>
      <div class="crumbs" style="margin-bottom: 6px">
        <span>Home</span>
        <VIcon name="chevron-right" :size="14" />
        <span class="cur">Reference data</span>
      </div>
      <h1 class="page-title">Reference data</h1>
    </div>
    <!-- Cohort selector -->
    <div v-if="cohorts.length" class="selectf">
      <span class="selectf-label">Cohort</span>
      <div style="position: relative; display: inline-flex; align-items: center">
        <select
          :value="selectedCohortId ?? ''"
          class="selectf-btn"
          style="appearance: none; -webkit-appearance: none; padding-right: 36px; cursor: pointer; width: 280px"
          @change="selectedCohortId = ($event.target as HTMLSelectElement).value"
        >
          <option v-for="c in cohorts" :key="c.id" :value="c.id">
            {{ c.name }}{{ !c.active ? ' (archived)' : '' }}
          </option>
        </select>
        <VIcon
          name="chevron-down"
          :size="16"
          style="position: absolute; right: 12px; pointer-events: none; color: var(--text-secondary)"
        />
      </div>
    </div>
    <p v-else-if="cohortError" class="inline-error" style="margin: 0"><VIcon name="alert-circle" :size="14" /> {{ cohortError }}</p>
  </div>

  <!-- Miller columns -->
  <div class="rd-grid">
    <!-- Column 1: Specializations -->
    <div class="card rd-col">
      <div class="rd-colhead">
        <h2 class="rd-coltitle">Specializations</h2>
        <button class="link" @click="showAddSpecDrawer = true">+ Add</button>
      </div>
      <div v-if="loading.specs" class="rd-list">
        <div v-for="i in 4" :key="i" class="rd-item" style="pointer-events: none">
          <span class="skel" style="width: 65%" />
        </div>
      </div>
      <div v-else-if="loadErrors.specs" class="empty">
        <div class="load-error-icon"><VIcon name="wifi-off" :size="22" /></div>
        <p class="load-error-title" style="font-size: 13px">Failed to load</p>
        <button class="link" style="font-size: 13px" @click="selectedCohortId && fetchSpecs(selectedCohortId)">Try again</button>
      </div>
      <div v-else-if="specializations.length" class="rd-list">
        <div
          v-for="s in specializations"
          :key="s.id"
          :class="['rd-item', { on: s.id === selectedSpecId }]"
          role="button"
          tabindex="0"
          @click="selectSpec(s.id)"
          @keydown.enter="selectSpec(s.id)"
        >
          <span>
            <span class="mono" style="font-size: 11px; color: var(--text-secondary); margin-right: 6px">{{ s.code }}</span>
            {{ s.name }}
          </span>
          <span style="display: flex; align-items: center; gap: 4px; flex-shrink: 0">
            <button class="rd-iconbtn" title="Edit" aria-label="Edit specialization" @click.stop="openEditSpec(s)">
              <VIcon name="pencil" :size="15" />
            </button>
            <VIcon v-if="s.id === selectedSpecId" name="chevron-right" :size="16" />
          </span>
        </div>
      </div>
      <div v-else class="empty">
        <VEmptyState icon="layers" title="No specializations" description="Add the first specialization to this cohort." />
      </div>
      <VTablePager
        v-if="!loading.specs && specTotalElements > 0"
        :total="specTotalElements"
        :page="specPage + 1"
        :page-size="specPageSize"
        @update:page="(p) => goToSpecPage(p - 1)"
        @update:page-size="onSpecPageSizeChange"
      />
    </div>

    <!-- Column 2: Modules -->
    <div class="card rd-col">
      <div class="rd-colhead">
        <h2 class="rd-coltitle">Modules</h2>
        <button v-if="selectedSpecId" class="link" @click="showAddModDrawer = true">+ Add</button>
      </div>
      <div v-if="loading.mods" class="rd-list">
        <div v-for="i in 4" :key="i" class="rd-item rd-item-mono" style="pointer-events: none">
          <span class="skel" style="width: 60%" />
        </div>
      </div>
      <div v-else-if="loadErrors.mods" class="empty">
        <div class="load-error-icon"><VIcon name="wifi-off" :size="22" /></div>
        <p class="load-error-title" style="font-size: 13px">Failed to load</p>
        <button class="link" style="font-size: 13px" @click="selectedSpecId && fetchMods(selectedSpecId)">Try again</button>
      </div>
      <div v-else-if="modules.length" class="rd-list">
        <div
          v-for="m in modules"
          :key="m.id"
          :class="['rd-item rd-item-mono', { on: m.id === selectedModId }]"
          role="button"
          tabindex="0"
          @click="selectMod(m.id)"
          @keydown.enter="selectMod(m.id)"
        >
          <span><b style="color: var(--text-secondary); font-weight: 500">{{ m.sequence }}.</b> {{ m.name }}</span>
          <span style="display: flex; align-items: center; gap: 4px; flex-shrink: 0">
            <button class="rd-iconbtn" title="Edit" aria-label="Edit module" @click.stop="openEditMod(m)">
              <VIcon name="pencil" :size="15" />
            </button>
            <VIcon v-if="m.id === selectedModId" name="chevron-right" :size="16" />
          </span>
        </div>
      </div>
      <div v-else-if="selectedSpecId" class="empty">
        <VEmptyState icon="inbox" title="No modules yet" description="Add the first module to this specialization." />
      </div>
      <div v-else class="empty">
        <p class="empty-body">Select a specialization to see its modules.</p>
      </div>
      <VTablePager
        v-if="!loading.mods && modTotalElements > 0"
        :total="modTotalElements"
        :page="modPage + 1"
        :page-size="modPageSize"
        @update:page="(p) => goToModPage(p - 1)"
        @update:page-size="onModPageSizeChange"
      />
    </div>

    <!-- Column 3: Labs -->
    <div class="card rd-col">
      <div class="rd-colhead">
        <h2 class="rd-coltitle">Labs</h2>
        <VButton
          v-if="selectedModId"
          variant="primary"
          size="sm"
          icon="plus"
          @click="showAddLabDrawer = true"
        >Add lab</VButton>
      </div>
      <div v-if="loading.labs" class="rd-list" style="border-top: 1px solid var(--border)">
        <div v-for="i in 4" :key="i" class="rd-item" style="pointer-events: none">
          <span class="skel" style="width: 55%" />
          <span class="skel mono" style="width: 36px" />
        </div>
      </div>
      <div v-else-if="loadErrors.labs" class="empty">
        <div class="load-error-icon"><VIcon name="wifi-off" :size="22" /></div>
        <p class="load-error-title" style="font-size: 13px">Failed to load</p>
        <button class="link" style="font-size: 13px" @click="selectedModId && fetchLabs(selectedModId)">Try again</button>
      </div>
      <template v-else-if="labs.length">
        <table class="tbl tbl-light" style="border-top: 1px solid var(--border)">
          <thead>
            <tr>
              <th>Lab title</th>
              <th style="text-align: right">Max score</th>
              <th style="text-align: right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in labs" :key="l.id">
              <td style="font-weight: 500">{{ l.title }}</td>
              <td class="mono" style="text-align: right">{{ l.maxScore }}</td>
              <td style="text-align: right; white-space: nowrap">
                <span class="rd-actions">
                  <button
                    class="rd-iconbtn"
                    :disabled="l.hasResults"
                    :title="l.hasResults ? 'Has results — locked' : 'Edit'"
                    aria-label="Edit"
                    @click="openEditLab(l)"
                  >
                    <VIcon name="pencil" :size="16" />
                  </button>
                  <button
                    v-if="l.hasResults"
                    class="rd-iconbtn"
                    title="Force edit"
                    aria-label="Force edit"
                    @click="openForceEdit(l)"
                  >
                    <VIcon name="lock" :size="16" />
                  </button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="rd-note">
          <VIcon name="info" :size="16" style="color: var(--navy); flex-shrink: 0" />
          <span>
            Labs with results attached cannot be edited. Use force-edit to update with audit trail.
          </span>
        </div>
        <VTablePager
          v-if="labTotalElements > 0"
          :total="labTotalElements"
          :page="labPage + 1"
          :page-size="labPageSize"
          @update:page="(p) => goToLabPage(p - 1)"
          @update:page-size="onLabPageSizeChange"
        />
      </template>
      <div v-else-if="selectedModId" class="empty">
        <VEmptyState icon="inbox" title="No labs yet" description="Add the first lab to this module." />
      </div>
      <div v-else class="empty">
        <p class="empty-body">Select a module to see its labs.</p>
      </div>
    </div>
  </div>

  <!-- Edit Specialization Drawer -->
  <VDrawer
    :open="!!editSpecTarget"
    title="Edit specialization"
    :subtitle="editSpecTarget?.name ?? ''"
    :error="editSpecForm.error || undefined"
    @close="closeEditSpec"
  >
    <label class="ff">
      <span class="ff-label">Code <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="editSpecForm.code" class="mono" placeholder="e.g. DA" />
      </span>
      <span class="ff-hint">Short uppercase identifier used in validation.</span>
    </label>
    <label class="ff">
      <span class="ff-label">Name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="editSpecForm.name" placeholder="e.g. Data Analytics" />
      </span>
    </label>
    <template #footer>
      <VButton variant="ghost" @click="closeEditSpec">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitEditSpec">Save changes</VButton>
    </template>
  </VDrawer>

  <!-- Edit Module Drawer -->
  <VDrawer
    :open="!!editModTarget"
    title="Edit module"
    :subtitle="editModTarget?.name ?? ''"
    :error="editModForm.error || undefined"
    @close="closeEditMod"
  >
    <label class="ff">
      <span class="ff-label">Module name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="editModForm.name" placeholder="e.g. Machine Learning Basics" />
      </span>
    </label>
    <div class="ff">
      <span class="ff-label">Status</span>
      <div style="position: relative; display: flex; align-items: center">
        <select
          v-model="editModForm.status"
          class="ff-input"
          style="appearance: none; -webkit-appearance: none; width: 100%; padding-right: 36px; cursor: pointer"
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <VIcon name="chevron-down" :size="16" style="position: absolute; right: 12px; pointer-events: none; color: var(--text-secondary)" />
      </div>
    </div>
    <template #footer>
      <VButton variant="ghost" @click="closeEditMod">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitEditMod">Save changes</VButton>
    </template>
  </VDrawer>

  <!-- Add Specialization Drawer -->
  <VDrawer
    :open="showAddSpecDrawer"
    :title="`Add specialization — ${selectedCohort?.name ?? ''}`"
    subtitle="Add a new specialization to the selected cohort."
    :error="addSpecForm.error || undefined"
    @close="closeAddSpecDrawer"
  >
    <label class="ff">
      <span class="ff-label">Code <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="addSpecForm.code" class="mono" placeholder="e.g. DA" />
      </span>
      <span class="ff-hint">Short uppercase identifier used in validation.</span>
    </label>
    <label class="ff">
      <span class="ff-label">Name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="addSpecForm.name" placeholder="e.g. Data Analytics" />
      </span>
    </label>
    <template #footer>
      <VButton variant="ghost" @click="closeAddSpecDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitAddSpec">
        Add specialization
      </VButton>
    </template>
  </VDrawer>

  <!-- Add Module Drawer -->
  <VDrawer
    :open="showAddModDrawer"
    title="Add module"
    :subtitle="`Add a module to ${selectedSpec?.name ?? 'this specialization'}.`"
    :error="addModForm.error || undefined"
    @close="closeAddModDrawer"
  >
    <label class="ff">
      <span class="ff-label">Module name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="addModForm.name" placeholder="e.g. Machine Learning Basics" />
      </span>
    </label>
    <template #footer>
      <VButton variant="ghost" @click="closeAddModDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitAddMod">Add module</VButton>
    </template>
  </VDrawer>

  <!-- Add Lab Drawer -->
  <VDrawer
    :open="showAddLabDrawer"
    title="Add lab"
    subtitle="Define a lab title and its maximum score."
    :error="addLabForm.error || undefined"
    @close="closeAddLabDrawer"
  >
    <label class="ff">
      <span class="ff-label">Lab title <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="addLabForm.title" placeholder="e.g. Lab 4 — Pandas" />
      </span>
      <span class="ff-hint">Validation compares the CSV lab_title against this value exactly.</span>
    </label>
    <label class="ff">
      <span class="ff-label">Max score <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="addLabForm.maxScore" class="mono" type="number" min="1" placeholder="100" />
      </span>
      <span class="ff-hint">Score in uploaded rows must be 0 ≤ score ≤ max score.</span>
    </label>
    <template #footer>
      <VButton variant="ghost" @click="closeAddLabDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitAddLab">Add lab</VButton>
    </template>
  </VDrawer>

  <!-- Edit Lab Drawer -->
  <VDrawer
    :open="!!editTarget"
    title="Edit lab"
    :subtitle="editTarget?.title ?? ''"
    :error="editLabForm.error || undefined"
    @close="closeEditLab"
  >
    <label class="ff">
      <span class="ff-label">Lab title <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="editLabForm.title" placeholder="e.g. Lab 4 — Pandas" />
      </span>
      <span class="ff-hint">Validation compares the CSV lab_title against this value exactly.</span>
    </label>
    <label class="ff">
      <span class="ff-label">Max score <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="editLabForm.maxScore" class="mono" type="number" min="1" />
      </span>
    </label>
    <template #footer>
      <VButton variant="ghost" @click="closeEditLab">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitEditLab">Save changes</VButton>
    </template>
  </VDrawer>

  <!-- Force Edit Modal -->
  <VModal
    :open="!!forceEditTarget"
    tone="warning"
    title="Force-edit lab"
    :subtitle="forceEditTarget?.title ?? ''"
    :error="forceEditForm.error || undefined"
    @close="closeForceEdit"
  >
    <div class="callout" style="margin-bottom: 4px">
      <VIcon name="alert-triangle" :size="20" style="color: #A83900" />
      <p class="callout-body">
        This lab has results attached. Changes apply forward-only and are recorded in the audit
        trail. Existing committed rows are not modified.
      </p>
    </div>
    <label class="ff">
      <span class="ff-label">New max score <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="forceEditForm.maxScore" class="mono" type="number" min="1" />
      </span>
    </label>
    <label class="ff">
      <span class="ff-label">Reason for change <span style="color: var(--danger)">*</span></span>
      <span class="ff-input" style="height: auto; align-items: stretch; padding: 12px">
        <textarea
          v-model="forceEditForm.reason"
          class="ff-textarea"
          placeholder="Required — recorded in the audit log (e.g. corrected from 80 to 100 per syllabus update)."
          rows="3"
        />
      </span>
    </label>
    <template #footer>
      <VButton variant="ghost" @click="closeForceEdit">Cancel</VButton>
      <VButton variant="danger" :disabled="submitting" @click="submitForceEdit">
        Confirm force-edit
      </VButton>
    </template>
  </VModal>
</template>
