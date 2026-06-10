<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import { useToastStore } from '@/stores/toast'
import { getInstructors, getModuleGroups, addInstructor, assignInstructorModules, removeInstructorModules, updateInstructor } from '@/services/user.service'
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
const assignedIds = ref<string[]>([])
const originalIds = ref<string[]>([])

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
  const currentIds = instructor.assignedModules.map((m) => m.moduleId)
  assignedIds.value = [...currentIds]
  originalIds.value = [...currentIds]
  showDrawer.value = true
}

function closeDrawer() {
  showDrawer.value = false
  editTarget.value = null
  resetForm()
}

function toggleModule(moduleId: string) {
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

  submitting.value = true
  try {
    if (editTarget.value) {
      const target = editTarget.value

      // ── Detect what actually changed ─────────────────────────────────────────
      const profileChanged =
        form.value.email.trim() !== target.email || form.value.isActive !== target.active
      const oldSet = new Set(originalIds.value)
      const newSet = new Set(assignedIds.value)
      const toAdd    = assignedIds.value.filter((id) => !oldSet.has(id))
      const toRemove = originalIds.value.filter((id) => !newSet.has(id))

      if (!profileChanged && toAdd.length === 0 && toRemove.length === 0) {
        closeDrawer()
        return
      }

      // ── Build only the needed operations ─────────────────────────────────────
      type OpKey = 'profile' | 'add' | 'remove'
      const ops: [OpKey, Promise<unknown>][] = []
      if (profileChanged) ops.push(['profile', updateInstructor(target.id, { email: form.value.email.trim(), isActive: form.value.isActive })])
      if (toAdd.length)    ops.push(['add',     assignInstructorModules(target.id, toAdd)])
      if (toRemove.length) ops.push(['remove',  removeInstructorModules(target.id, toRemove)])

      const settled = await Promise.allSettled(ops.map(([, p]) => p))
      const results = Object.fromEntries(
        ops.map(([key], i) => [key, settled[i]!]),
      ) as Partial<Record<OpKey, PromiseSettledResult<unknown>>>

      const profileFailed = results.profile?.status === 'rejected'
      const addFailed     = results.add?.status === 'rejected'
      const removeFailed  = results.remove?.status === 'rejected'

      if (profileFailed) console.error('[instructor:update] profile stage failed', (results.profile as PromiseRejectedResult).reason)
      if (addFailed)     console.error('[instructor:update] module-assign stage failed', (results.add as PromiseRejectedResult).reason)
      if (removeFailed)  console.error('[instructor:update] module-remove stage failed', (results.remove as PromiseRejectedResult).reason)

      if (settled.every((r) => r.status === 'rejected')) {
        form.value.error = 'All updates failed. Please try again.'
        return
      }

      // ── Reconstruct local state from what succeeded ───────────────────────────
      let updatedInstructor: InstructorUser = { ...target }

      if (profileChanged && !profileFailed) {
        const p = (results.profile as PromiseFulfilledResult<InstructorUser>).value
        updatedInstructor = { ...updatedInstructor, email: p.email, active: p.active }
      }

      let updatedModules = [...target.assignedModules]
      if (toRemove.length && !removeFailed) {
        const removedSet = new Set(toRemove)
        updatedModules = updatedModules.filter((m) => !removedSet.has(m.moduleId))
      }
      if (toAdd.length && !addFailed) {
        const added = (results.add as PromiseFulfilledResult<AssignModulesResponse>).value.assignedModules
        const existing = new Set(updatedModules.map((m) => m.moduleId))
        updatedModules = [...updatedModules, ...added.filter((m) => !existing.has(m.moduleId))]
      }
      updatedInstructor.assignedModules = updatedModules

      const idx = instructors.value.findIndex((u) => u.id === target.id)
      if (idx !== -1) instructors.value[idx] = updatedInstructor

      const anyFailed = settled.some((r) => r.status === 'rejected')
      if (anyFailed) {
        const parts = [
          profileFailed && 'profile update',
          addFailed     && 'module assignment',
          removeFailed  && 'module removal',
        ].filter(Boolean).join(' and ')
        toast.show({ tone: 'warning', title: 'Partially saved', body: `${parts} failed — edit the instructor to retry.` })
      } else {
        toast.show({ tone: 'success', title: 'Instructor updated' })
      }
      closeDrawer()
    } else {
      // Stage 1 — create the account
      const created = await addInstructor({
        email: form.value.email.trim(),
        isActive: form.value.isActive,
      })

      // Stage 2 — assign modules (best-effort; instructor already exists if this fails)
      if (assignedIds.value.length > 0) {
        try {
          const result = await assignInstructorModules(created.id, [...assignedIds.value])
          instructors.value.push({ id: created.id, email: created.email, active: form.value.isActive, assignedModules: result.assignedModules })
        } catch (err) {
          console.error('[instructor:create] module-assign stage failed', err)
          instructors.value.push({ id: created.id, email: created.email, active: form.value.isActive, assignedModules: [] })
          toast.show({ tone: 'warning', title: 'Instructor created', body: 'Module assignment failed — edit the instructor to retry.' })
          closeDrawer()
          return
        }
      } else {
        instructors.value.push({ id: created.id, email: created.email, active: form.value.isActive, assignedModules: [] })
      }

      toast.show({ tone: 'success', title: 'Instructor added' })
      closeDrawer()
    }
  } catch (err) {
    if (editTarget.value) {
      console.error('[instructor:update] unexpected error', err)
    } else {
      console.error('[instructor:create] account stage failed', err)
    }
    form.value.error = editTarget.value
      ? 'Failed to update instructor. Please try again.'
      : 'Failed to create instructor. Please try again.'
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
        <tr v-for="u in instructors" :key="u.id">
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

    <div>
      <div class="ff-group-title">Module assignments</div>
      <p class="ff-hint" style="margin-top: 4px">
        Instructors can only upload results for the modules selected here.
      </p>
    </div>

    <div class="mod-assign-list">
      <p v-if="!moduleGroups.length" class="mod-assign-empty">
        <VIcon name="layers" :size="15" />
        No modules available.
      </p>
      <div v-for="group in moduleGroups" :key="group.specId" class="mg">
        <div class="mg-head">
          <span class="mg-spec">{{ group.specName }}</span>
          <button class="link" @click="toggleGroup(group)">
            {{ isGroupAllSelected(group) ? 'Deselect all' : 'Select all' }}
          </button>
        </div>
        <label v-for="m in group.modules" :key="m.id" class="mg-row" style="cursor: pointer">
          <input type="checkbox" :checked="assignedIds.includes(m.id)" @change="toggleModule(m.id)" />
          <span>{{ m.name }}</span>
        </label>
      </div>
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
.mod-assign-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mod-assign-empty {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 16px 4px;
  margin: 0;
}
</style>
