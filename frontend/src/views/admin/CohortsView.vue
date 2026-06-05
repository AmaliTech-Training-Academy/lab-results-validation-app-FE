<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import { useToastStore } from '@/stores/toast'
import { getCohorts, createCohort, updateCohort, setCohortStatus } from '@/services/cohort.service'
import type { CohortRow, CohortStatus } from '@/types/cohort.types'
import type { Tone } from '@/types/dashboard.types'

const router = useRouter()
const toast = useToastStore()

// ── Data ─────────────────────────────────────────────────────────────────────
const cohorts = ref<CohortRow[]>([])
const isLoading = ref(true)

// ── Drawer ────────────────────────────────────────────────────────────────────
const showDrawer = ref(false)
const editTarget = ref<CohortRow | null>(null)
const submitting = ref(false)
const form = ref({ name: '', startDate: '', endDate: '', status: 'pending' as CohortStatus, error: '' })

// ── Kebab ─────────────────────────────────────────────────────────────────────
const activeKebabId = ref<number | null>(null)

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_TONE: Record<CohortStatus, Tone> = {
  active: 'warning',
  pending: 'info',
  completed: 'success',
}

const STATUS_LABEL: Record<CohortStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  completed: 'Completed',
}

const drawerTitle = computed(() => editTarget.value ? 'Edit cohort' : 'Create new cohort')

// ── Pagination ────────────────────────────────────────────────────────────────
const total = computed(() => cohorts.value.length)

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  cohorts.value = await getCohorts()
  isLoading.value = false
  window.addEventListener('click', closeKebab)
})

onUnmounted(() => {
  window.removeEventListener('click', closeKebab)
})

// ── Actions ───────────────────────────────────────────────────────────────────
function closeKebab() {
  activeKebabId.value = null
}

function toggleKebab(event: MouseEvent, id: number) {
  event.stopPropagation()
  activeKebabId.value = activeKebabId.value === id ? null : id
}

function openCreate() {
  editTarget.value = null
  form.value = { name: '', startDate: '', endDate: '', status: 'pending', error: '' }
  showDrawer.value = true
}

function openEdit(cohort: CohortRow) {
  activeKebabId.value = null
  editTarget.value = cohort
  form.value = { name: cohort.name, startDate: cohort.startDate, endDate: cohort.endDate, status: cohort.status, error: '' }
  showDrawer.value = true
}

function closeDrawer() {
  showDrawer.value = false
  editTarget.value = null
  form.value = { name: '', startDate: '', endDate: '', status: 'pending', error: '' }
}

async function submitForm() {
  form.value.error = ''
  if (!form.value.name.trim() || !form.value.startDate || !form.value.endDate) {
    form.value.error = 'Name, start date, and end date are required.'
    return
  }
  submitting.value = true
  const payload = { name: form.value.name.trim(), startDate: form.value.startDate, endDate: form.value.endDate, status: form.value.status }
  if (editTarget.value) {
    const updated = await updateCohort(editTarget.value.id, payload)
    const idx = cohorts.value.findIndex((c) => c.id === editTarget.value!.id)
    if (idx !== -1) {
      cohorts.value[idx]!.name = updated.name
      cohorts.value[idx]!.startDate = updated.startDate
      cohorts.value[idx]!.endDate = updated.endDate
      cohorts.value[idx]!.status = updated.status
    }
    toast.show({ tone: 'success', title: 'Cohort updated' })
  } else {
    const created = await createCohort(payload)
    cohorts.value.push(created)
    toast.show({ tone: 'success', title: 'Cohort created' })
  }
  submitting.value = false
  closeDrawer()
}

async function toggleStatus(cohort: CohortRow) {
  activeKebabId.value = null
  const newStatus: CohortStatus = cohort.status === 'completed' ? 'active' : 'completed'
  await setCohortStatus(cohort.id, newStatus)
  const idx = cohorts.value.findIndex((c) => c.id === cohort.id)
  if (idx !== -1) cohorts.value[idx]!.status = newStatus
  toast.show({ tone: 'success', title: newStatus === 'completed' ? 'Cohort archived' : 'Cohort restored' })
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

  <!-- Loading -->
  <div v-if="isLoading" class="empty"><div class="spinner" /></div>

  <!-- Table -->
  <div v-else class="tbl-wrap">
    <table class="tbl">
      <thead>
        <tr>
          <th>Cohort Name</th>
          <th>Start Date</th>
          <th>End Date</th>
          <th style="text-align: right">Specializations</th>
          <th style="text-align: center">Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in cohorts" :key="c.id">
          <td style="font-weight: 600">{{ c.name }}</td>
          <td class="mono" style="color: var(--text-secondary)">{{ c.startDate }}</td>
          <td class="mono" style="color: var(--text-secondary)">{{ c.endDate }}</td>
          <td style="text-align: right">{{ c.specializationCount }}</td>
          <td style="text-align: center">
            <VPill :tone="STATUS_TONE[c.status]">{{ STATUS_LABEL[c.status] }}</VPill>
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
                @click="toggleStatus(c)"
              >
                <VIcon :name="c.status === 'completed' ? 'rotate-ccw' : 'archive'" :size="15" style="color: var(--text-secondary)" />
                {{ c.status === 'completed' ? 'Restore' : 'Archive' }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div class="pager">
      <span class="pager-count">Showing 1 to {{ total }} of {{ total }} entries</span>
      <div class="pager-ctrls">
        <button class="pg-arrow" aria-label="Previous" disabled><VIcon name="chevron-left" :size="16" /></button>
        <button class="pg-num on">1</button>
        <button class="pg-arrow" aria-label="Next" disabled><VIcon name="chevron-right" :size="16" /></button>
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
      <label class="ff">
        <span class="ff-label">Start date <span style="color: var(--danger)">*</span></span>
        <span class="ff-input">
          <input v-model="form.startDate" class="mono" placeholder="YYYY-MM-DD" />
        </span>
      </label>
      <label class="ff">
        <span class="ff-label">End date <span style="color: var(--danger)">*</span></span>
        <span class="ff-input">
          <input v-model="form.endDate" class="mono" placeholder="YYYY-MM-DD" />
        </span>
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
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
        <VIcon name="chevron-down" :size="16" style="position: absolute; right: 12px; pointer-events: none; color: var(--text-secondary)" />
      </div>
      <span class="ff-hint">Soft-archival flag — set to Active when the cohort begins.</span>
    </label>
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
