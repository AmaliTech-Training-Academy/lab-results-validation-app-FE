<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import VModal from '@/components/base/VModal.vue'
import { useToastStore } from '@/stores/toast'
import {
  getCohorts,
  getSpecializations,
  getModules,
  getLabs,
  addSpecialization,
  addModule,
  addLab,
  updateLab,
  forceEditLab,
} from '@/services/reference.service'
import type { Cohort, Specialization, Module, Lab } from '@/types/reference.types'

const toast = useToastStore()

// ── Data ────────────────────────────────────────────────────────────────────
const cohorts = ref<Cohort[]>([])
const specializations = ref<Specialization[]>([])
const modules = ref<Module[]>([])
const labs = ref<Lab[]>([])

// ── Selection ────────────────────────────────────────────────────────────────
const selectedCohortId = ref<number | null>(null)
const selectedSpecId = ref<number | null>(null)
const selectedModId = ref<number | null>(null)

// ── Loading ──────────────────────────────────────────────────────────────────
const loading = ref({ specs: false, mods: false, labs: false })
const submitting = ref(false)

// ── Drawer / Modal visibility ────────────────────────────────────────────────
const showAddSpecDrawer = ref(false)
const showAddModDrawer = ref(false)
const showAddLabDrawer = ref(false)
const editTarget = ref<Lab | null>(null)
const forceEditTarget = ref<Lab | null>(null)

// ── Forms ────────────────────────────────────────────────────────────────────
const addSpecForm = ref({ name: '', error: '' })
const addModForm = ref({ name: '', code: '', error: '' })
const addLabForm = ref({ title: '', maxScore: '', error: '' })
const editLabForm = ref({ title: '', maxScore: '', error: '' })
const forceEditForm = ref({ maxScore: '', reason: '', error: '' })

// ── Computed ─────────────────────────────────────────────────────────────────
const selectedSpec = computed(() =>
  specializations.value.find((s) => s.id === selectedSpecId.value) ?? null,
)

// ── Watchers ─────────────────────────────────────────────────────────────────
watch(selectedCohortId, async (id) => {
  specializations.value = []
  modules.value = []
  labs.value = []
  selectedSpecId.value = null
  selectedModId.value = null
  if (id === null) return
  loading.value.specs = true
  specializations.value = await getSpecializations(id)
  loading.value.specs = false
})

watch(selectedSpecId, async (id) => {
  modules.value = []
  labs.value = []
  selectedModId.value = null
  if (id === null) return
  loading.value.mods = true
  modules.value = await getModules(id)
  loading.value.mods = false
})

watch(selectedModId, async (id) => {
  labs.value = []
  if (id === null) return
  loading.value.labs = true
  labs.value = await getLabs(id)
  loading.value.labs = false
})

// ── Mount ────────────────────────────────────────────────────────────────────
onMounted(async () => {
  cohorts.value = await getCohorts()
  if (cohorts.value.length > 0) {
    selectedCohortId.value = cohorts.value[0]!.id
  }
})

// ── Actions ──────────────────────────────────────────────────────────────────
function selectSpec(id: number) {
  selectedSpecId.value = id
}

function selectMod(id: number) {
  selectedModId.value = id
}

function closeAddSpecDrawer() {
  showAddSpecDrawer.value = false
  addSpecForm.value = { name: '', error: '' }
}

function closeAddModDrawer() {
  showAddModDrawer.value = false
  addModForm.value = { name: '', code: '', error: '' }
}

function closeAddLabDrawer() {
  showAddLabDrawer.value = false
  addLabForm.value = { title: '', maxScore: '', error: '' }
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
  if (!addSpecForm.value.name.trim()) {
    addSpecForm.value.error = 'Name is required.'
    return
  }
  submitting.value = true
  const spec = await addSpecialization(selectedCohortId.value!, addSpecForm.value.name.trim())
  specializations.value.push(spec)
  submitting.value = false
  closeAddSpecDrawer()
  toast.show({ tone: 'success', title: 'Specialization added' })
}

async function submitAddMod() {
  addModForm.value.error = ''
  if (!addModForm.value.code.trim() || !addModForm.value.name.trim()) {
    addModForm.value.error = 'Code and name are required.'
    return
  }
  submitting.value = true
  const mod = await addModule(
    selectedSpecId.value!,
    addModForm.value.name.trim(),
    addModForm.value.code.trim(),
  )
  modules.value.push(mod)
  submitting.value = false
  closeAddModDrawer()
  toast.show({ tone: 'success', title: 'Module added' })
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
  const lab = await addLab({
    moduleId: selectedModId.value!,
    title: addLabForm.value.title.trim(),
    maxScore: max,
  })
  labs.value.push(lab)
  submitting.value = false
  closeAddLabDrawer()
  toast.show({ tone: 'success', title: 'Lab added' })
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
  await updateLab(editTarget.value!.id, editLabForm.value.title.trim(), max)
  const idx = labs.value.findIndex((l) => l.id === editTarget.value!.id)
  if (idx !== -1) {
    labs.value[idx]!.title = editLabForm.value.title.trim()
    labs.value[idx]!.maxScore = max
  }
  submitting.value = false
  closeEditLab()
  toast.show({ tone: 'success', title: 'Lab updated' })
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
  await forceEditLab({
    labId: forceEditTarget.value!.id,
    maxScore: max,
    reason: forceEditForm.value.reason.trim(),
  })
  const idx = labs.value.findIndex((l) => l.id === forceEditTarget.value!.id)
  if (idx !== -1) labs.value[idx]!.maxScore = max
  submitting.value = false
  closeForceEdit()
  toast.show({ tone: 'success', title: 'Lab updated', body: 'Change recorded in audit trail.' })
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
          @change="selectedCohortId = Number(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="c in cohorts" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <VIcon
          name="chevron-down"
          :size="16"
          style="position: absolute; right: 12px; pointer-events: none; color: var(--text-secondary)"
        />
      </div>
    </div>
  </div>

  <!-- Miller columns -->
  <div class="rd-grid">
    <!-- Column 1: Specializations -->
    <div class="card rd-col">
      <div class="rd-colhead">
        <h2 class="rd-coltitle">Specializations</h2>
        <button class="link" @click="showAddSpecDrawer = true">+ Add</button>
      </div>
      <div v-if="loading.specs" class="empty"><div class="spinner" /></div>
      <div v-else-if="specializations.length" class="rd-list">
        <button
          v-for="s in specializations"
          :key="s.id"
          :class="['rd-item', { on: s.id === selectedSpecId }]"
          @click="selectSpec(s.id)"
        >
          <span>{{ s.name }}</span>
          <VIcon v-if="s.id === selectedSpecId" name="chevron-right" :size="16" />
        </button>
      </div>
      <div v-else class="empty">
        <div class="empty-ic"><VIcon name="layers" :size="30" /></div>
        <p class="empty-title">No specializations</p>
        <p class="empty-body">Add the first specialization to this cohort.</p>
      </div>
    </div>

    <!-- Column 2: Modules -->
    <div class="card rd-col">
      <div class="rd-colhead">
        <h2 class="rd-coltitle">Modules</h2>
        <button v-if="selectedSpecId" class="link" @click="showAddModDrawer = true">+ Add</button>
      </div>
      <div v-if="loading.mods" class="empty"><div class="spinner" /></div>
      <div v-else-if="modules.length" class="rd-list">
        <button
          v-for="m in modules"
          :key="m.id"
          :class="['rd-item rd-item-mono', { on: m.id === selectedModId }]"
          @click="selectMod(m.id)"
        >
          <span><b>{{ m.code }}</b> · {{ m.name }}</span>
          <VIcon v-if="m.id === selectedModId" name="chevron-right" :size="16" />
        </button>
      </div>
      <div v-else-if="selectedSpecId" class="empty">
        <div class="empty-ic"><VIcon name="inbox" :size="30" /></div>
        <p class="empty-title">No modules yet</p>
        <p class="empty-body">Add the first module to this specialization.</p>
      </div>
      <div v-else class="empty">
        <p class="empty-body">Select a specialization to see its modules.</p>
      </div>
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
      <div v-if="loading.labs" class="empty"><div class="spinner" /></div>
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
          <VIcon name="info" :size="16" style="color: var(--orange-deep); flex-shrink: 0" />
          <span>
            Labs with results attached cannot be edited. Use force-edit to update with audit trail.
          </span>
        </div>
      </template>
      <div v-else-if="selectedModId" class="empty">
        <div class="empty-ic"><VIcon name="inbox" :size="30" /></div>
        <p class="empty-title">No labs yet</p>
        <p class="empty-body">Add the first lab to this module.</p>
      </div>
      <div v-else class="empty">
        <p class="empty-body">Select a module to see its labs.</p>
      </div>
    </div>
  </div>

  <!-- Add Specialization Drawer -->
  <VDrawer
    :open="showAddSpecDrawer"
    title="Add specialization"
    subtitle="Add a new specialization to the selected cohort."
    @close="closeAddSpecDrawer"
  >
    <label class="ff">
      <span class="ff-label">Name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="addSpecForm.name" placeholder="e.g. Data Analytics" />
      </span>
    </label>
    <p v-if="addSpecForm.error" class="field-error">
      <VIcon name="alert-circle" :size="14" />{{ addSpecForm.error }}
    </p>
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
    @close="closeAddModDrawer"
  >
    <label class="ff">
      <span class="ff-label">Module code <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="addModForm.code" class="mono" placeholder="e.g. DA-05" />
      </span>
      <span class="ff-hint">Used as a short identifier in CSV validation.</span>
    </label>
    <label class="ff">
      <span class="ff-label">Module name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="addModForm.name" placeholder="e.g. Machine Learning Basics" />
      </span>
    </label>
    <p v-if="addModForm.error" class="field-error">
      <VIcon name="alert-circle" :size="14" />{{ addModForm.error }}
    </p>
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
    <p v-if="addLabForm.error" class="field-error">
      <VIcon name="alert-circle" :size="14" />{{ addLabForm.error }}
    </p>
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
    <p v-if="editLabForm.error" class="field-error">
      <VIcon name="alert-circle" :size="14" />{{ editLabForm.error }}
    </p>
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
    <p v-if="forceEditForm.error" class="field-error">
      <VIcon name="alert-circle" :size="14" />{{ forceEditForm.error }}
    </p>
    <template #footer>
      <VButton variant="ghost" @click="closeForceEdit">Cancel</VButton>
      <VButton variant="danger" :disabled="submitting" @click="submitForceEdit">
        Confirm force-edit
      </VButton>
    </template>
  </VModal>
</template>
