<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import { useToastStore } from '@/stores/toast'
import { getInstructors, getModuleGroups, addInstructor, updateInstructor } from '@/services/user.service'
import type { InstructorUser, ModuleGroup } from '@/types/user.types'

const toast = useToastStore()

// ── Data ─────────────────────────────────────────────────────────────────────
const instructors = ref<InstructorUser[]>([])
const moduleGroups = ref<ModuleGroup[]>([])
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadSlow = ref(false)
const LOAD_TIMEOUT_MS = 8000

// ── Drawer ────────────────────────────────────────────────────────────────────
const showDrawer = ref(false)
const editTarget = ref<InstructorUser | null>(null)
const submitting = ref(false)
const form = ref({ email: '', isActive: true, error: '' })
const assignedIds = ref<number[]>([])

// ── Computed ──────────────────────────────────────────────────────────────────
const drawerTitle = computed(() => (editTarget.value ? 'Edit instructor' : 'Add instructor'))
const drawerSubtitle = computed(() =>
  editTarget.value ? emailToName(editTarget.value.email) : 'Provision a new instructor account.',
)

function emailToName(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
async function loadData() {
  isLoading.value = true
  loadError.value = null
  loadSlow.value = false

  const slowTimer = setTimeout(() => { loadSlow.value = true }, LOAD_TIMEOUT_MS)
  try {
    ;[instructors.value, moduleGroups.value] = await Promise.all([getInstructors(), getModuleGroups()])
  } catch {
    loadError.value = 'Failed to load instructors. Check your connection and try again.'
  } finally {
    clearTimeout(slowTimer)
    isLoading.value = false
    loadSlow.value = false
  }
}

onMounted(loadData)

// ── Actions ───────────────────────────────────────────────────────────────────
function resetForm() {
  form.value = { email: '', isActive: true, error: '' }
  assignedIds.value = []
}

function openAdd() {
  editTarget.value = null
  resetForm()
  showDrawer.value = true
}

function openEdit(instructor: InstructorUser) {
  editTarget.value = instructor
  form.value = { email: instructor.email, isActive: instructor.active, error: '' }
  assignedIds.value = []
  showDrawer.value = true
}

function closeDrawer() {
  showDrawer.value = false
  editTarget.value = null
  resetForm()
}

function toggleModule(moduleId: number) {
  const idx = assignedIds.value.indexOf(moduleId)
  if (idx === -1) {
    assignedIds.value.push(moduleId)
  } else {
    assignedIds.value.splice(idx, 1)
  }
}

function isGroupAllSelected(group: ModuleGroup): boolean {
  return group.modules.length > 0 && group.modules.every((m) => assignedIds.value.includes(m.id))
}

function toggleGroup(group: ModuleGroup) {
  if (isGroupAllSelected(group)) {
    group.modules.forEach((m) => {
      const idx = assignedIds.value.indexOf(m.id)
      if (idx !== -1) assignedIds.value.splice(idx, 1)
    })
  } else {
    group.modules.forEach((m) => {
      if (!assignedIds.value.includes(m.id)) assignedIds.value.push(m.id)
    })
  }
}

async function submitForm() {
  form.value.error = ''
  if (!form.value.email.trim()) {
    form.value.error = 'Email address is required.'
    return
  }

  const payload = {
    email: form.value.email.trim(),
    isActive: form.value.isActive,
    assignedModuleIds: [...assignedIds.value],
  }

  submitting.value = true
  try {
    if (editTarget.value) {
      const updated = await updateInstructor(editTarget.value.email, payload)
      const idx = instructors.value.findIndex((u) => u.email === editTarget.value!.email)
      if (idx !== -1) instructors.value[idx] = updated
      toast.show({ tone: 'success', title: 'Instructor updated' })
    } else {
      const created = await addInstructor(payload)
      instructors.value.push(created)
      toast.show({ tone: 'success', title: 'Instructor added' })
    }
    closeDrawer()
  } catch {
    form.value.error = editTarget.value
      ? 'Failed to update instructor. Please try again.'
      : 'Failed to add instructor. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <!-- Page header -->
  <div class="page-head">
    <div>
      <h1 class="page-title">User management</h1>
      <p class="page-sub">Manage instructor accounts and module assignments.</p>
    </div>
    <VButton variant="primary" icon="user-plus" @click="openAdd">Add instructor</VButton>
  </div>

  <!-- Slow-connection warning -->
  <div v-if="loadSlow && isLoading" class="load-slow-banner">
    <VIcon name="clock" :size="15" />
    This is taking longer than expected…
  </div>

  <!-- Error state -->
  <div v-else-if="loadError && !isLoading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load instructors</p>
    <p class="load-error-sub">{{ loadError }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="loadData">Try again</VButton>
  </div>

  <!-- Table -->
  <div v-else class="tbl-wrap">
    <table class="tbl">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th style="text-align: center">Assigned modules</th>
          <th style="text-align: center">Status</th>
          <th style="text-align: right">Actions</th>
        </tr>
      </thead>
      <tbody v-if="isLoading">
        <tr v-for="i in 5" :key="i" class="skel-row">
          <td><span class="skel" style="width: 45%" /></td>
          <td><span class="skel mono" style="width: 65%" /></td>
          <td style="text-align: center"><span class="skel" style="width: 24px; display: inline-block" /></td>
          <td style="text-align: center"><span class="skel" style="width: 60px; border-radius: 999px; display: inline-block" /></td>
          <td style="text-align: right"><span class="skel" style="width: 32px; display: inline-block" /></td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-if="!instructors.length">
          <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 32px">
            No instructors yet. Add one to get started.
          </td>
        </tr>
        <tr v-for="u in instructors" :key="u.email">
          <td style="font-weight: 600">{{ emailToName(u.email) }}</td>
          <td class="mono" style="color: var(--text-secondary)">{{ u.email }}</td>
          <td style="text-align: center">{{ u.assignedModules.length }}</td>
          <td style="text-align: center">
            <VPill :tone="u.active ? 'success' : 'info'">
              {{ u.active ? 'Active' : 'Inactive' }}
            </VPill>
          </td>
          <td style="text-align: right">
            <button class="link" @click="openEdit(u)">Edit</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Add / Edit Drawer -->
  <VDrawer :open="showDrawer" :title="drawerTitle" :subtitle="drawerSubtitle" @close="closeDrawer">
    <div class="ff-group-title">Account details</div>

    <div class="ff">
      <span class="ff-label">Email address <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input
          v-model="form.email"
          class="mono"
          type="email"
          placeholder="name@organization.com"
          :disabled="!!editTarget"
        />
      </span>
      <span class="ff-hint">Email cannot be changed after creation.</span>
    </div>

    <div class="ff">
      <span class="ff-label">Account status</span>
      <label class="toggle-row" style="cursor: pointer">
        <span class="toggle" :class="{ on: form.isActive }" @click="form.isActive = !form.isActive">
          <span class="toggle-knob" />
        </span>
        <span>{{ form.isActive ? 'Active' : 'Inactive' }}</span>
      </label>
    </div>

    <!-- Current assignments (edit mode only) -->
    <template v-if="editTarget && editTarget.assignedModules.length">
      <div class="ff-group-title" style="margin-top: 8px">Current assignments</div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px">
        <span
          v-for="m in editTarget.assignedModules"
          :key="m.moduleId"
          class="module-chip"
        >{{ m.moduleName }}</span>
      </div>
    </template>

    <div class="ff-group-title" style="margin-top: 8px">
      {{ editTarget ? 'Update module assignments' : 'Assigned modules' }}
    </div>
    <p class="ff-hint" style="margin-top: -4px">
      Instructors can only upload results for the modules selected here.
    </p>

    <div
      v-for="group in moduleGroups"
      :key="group.specId"
      style="border: 1px solid var(--border); border-radius: var(--r-sm); overflow: hidden"
    >
      <div class="mg-head">
        <span class="mg-spec">{{ group.specName }}</span>
        <button class="link" @click="toggleGroup(group)">
          {{ isGroupAllSelected(group) ? 'Deselect all' : 'Select all' }}
        </button>
      </div>
      <label v-for="m in group.modules" :key="m.id" class="mg-row" style="cursor: pointer">
        <input type="checkbox" :checked="assignedIds.includes(m.id)" @change="toggleModule(m.id)" />
        <span class="mono mg-code">{{ m.code }}</span>
        <span>{{ m.name }}</span>
      </label>
    </div>

    <p v-if="form.error" class="field-error">
      <VIcon name="alert-circle" :size="14" />{{ form.error }}
    </p>

    <template #footer>
      <VButton variant="ghost" @click="closeDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitForm">
        {{ editTarget ? 'Save changes' : 'Add instructor' }}
      </VButton>
    </template>
  </VDrawer>
</template>

<style scoped>
.module-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
