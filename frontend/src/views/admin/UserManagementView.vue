<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import { useToastStore } from '@/stores/toast'
import { toErrorMessage } from '@/utils/errors'
import { getInstructors, getModuleGroups, addInstructor, assignInstructorModules, removeInstructorModules, updateInstructor } from '@/services/user.service'
import type { InstructorUser, ModuleGroup, AssignModulesResponse } from '@/types/user.types'

const toast = useToastStore()

const PAGE_SIZE = 10

// ── Data ─────────────────────────────────────────────────────────────────────
const instructors = ref<InstructorUser[]>([])
const moduleGroups = ref<ModuleGroup[]>([])
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadSlow = ref(false)
const LOAD_TIMEOUT_MS = 8000

// ── Pagination ────────────────────────────────────────────────────────────────
const currentPage = ref(0)
const totalElements = ref(0)
const totalPages = ref(0)
const isLastPage = ref(true)

// ── Kebab ─────────────────────────────────────────────────────────────────────
const activeKebabId = ref<string | null>(null)
const kebabPos = ref<{ top: number; left: number } | null>(null)
const activeKebabInstructor = computed(() => instructors.value.find((u) => u.id === activeKebabId.value) ?? null)

// ── Manage columns ─────────────────────────────────────────────────────────
const cols = ref({ email: true, modules: true, status: true })
const COL_LABELS: { key: keyof typeof cols.value; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'modules', label: 'Assigned modules' },
  { key: 'status', label: 'Status' },
]
const colCount = computed(() => 1 + Object.values(cols.value).filter(Boolean).length + 1)
const showColMenu = ref(false)
const colMenuPos = ref<{ top: number; left: number } | null>(null)
function toggleColMenu(event: MouseEvent) {
  event.stopPropagation()
  activeKebabId.value = null
  kebabPos.value = null
  showColMenu.value = !showColMenu.value
  if (showColMenu.value) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    colMenuPos.value = { top: rect.bottom + 6, left: rect.right - 200 }
  }
}

// ── Export (fetches the full set, not just the current page) ────────────────
const exporting = ref(false)
function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
async function exportCsv() {
  showColMenu.value = false
  exporting.value = true
  try {
    const all = await getInstructors(0, 1000)
    const header = ['Name', 'Email', 'Assigned modules', 'Status']
    const body = all.content.map((u) =>
      [emailToName(u.email), u.email, u.assignedModules.length, u.active ? 'Active' : 'Inactive'].map(csvCell).join(','),
    )
    const csv = [header.map(csvCell).join(','), ...body].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'instructors.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.show({ tone: 'success', title: 'Export ready', body: `${all.content.length} instructor${all.content.length === 1 ? '' : 's'} exported to CSV.` })
  } catch (e) {
    toast.show({ tone: 'warning', title: 'Export failed', body: toErrorMessage(e, 'Could not export instructors.') })
  } finally {
    exporting.value = false
  }
}

// ── Modules Viewer ────────────────────────────────────────────────────────────
const showModulesDrawer = ref(false)
const modulesTarget = ref<InstructorUser | null>(null)

const groupedModules = computed(() => {
  if (!modulesTarget.value) return []
  const map = new Map<string, string[]>()
  for (const m of modulesTarget.value.assignedModules) {
    const list = map.get(m.specializationName) ?? []
    list.push(m.moduleName)
    map.set(m.specializationName, list)
  }
  return Array.from(map.entries()).map(([spec, modules]) => ({ spec, modules }))
})

function openModules(instructor: InstructorUser) {
  modulesTarget.value = instructor
  showModulesDrawer.value = true
}

function closeModulesDrawer() {
  showModulesDrawer.value = false
  modulesTarget.value = null
}

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

const showingFrom = computed(() => totalElements.value === 0 ? 0 : currentPage.value * PAGE_SIZE + 1)
const showingTo = computed(() => Math.min((currentPage.value + 1) * PAGE_SIZE, totalElements.value))

function emailToName(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
async function loadInstructors(page = 0) {
  isLoading.value = true
  loadError.value = null
  loadSlow.value = false
  const slowTimer = setTimeout(() => { loadSlow.value = true }, LOAD_TIMEOUT_MS)
  try {
    const result = await getInstructors(page, PAGE_SIZE)
    instructors.value = result.content
    currentPage.value = result.page
    totalElements.value = result.totalElements
    totalPages.value = result.totalPages
    isLastPage.value = result.last
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    loadError.value = msg || 'Failed to load instructors. Check your connection and try again.'
  } finally {
    clearTimeout(slowTimer)
    isLoading.value = false
    loadSlow.value = false
  }
}

async function loadData() {
  const groupsPromise = getModuleGroups()
    .then((g) => { moduleGroups.value = g })
    .catch((e) => {
      toast.show({
        tone: 'warning',
        title: 'Could not load module groups',
        body: e instanceof Error ? e.message : 'Module assignment options are unavailable.',
      })
    })
  await Promise.all([loadInstructors(0), groupsPromise])
}

function goToPage(page: number) {
  if (page < 0 || page >= totalPages.value) return
  loadInstructors(page)
}

onMounted(() => {
  loadData()
  window.addEventListener('click', closeKebab)
})

onUnmounted(() => {
  window.removeEventListener('click', closeKebab)
})

// ── Actions ───────────────────────────────────────────────────────────────────
function closeKebab() {
  activeKebabId.value = null
  kebabPos.value = null
  showColMenu.value = false
}

function toggleKebab(event: MouseEvent, id: string) {
  event.stopPropagation()
  if (activeKebabId.value === id) {
    closeKebab()
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  kebabPos.value = { top: rect.bottom + 4, left: rect.right - 160 }
  activeKebabId.value = id
}

async function toggleStatus(instructor: InstructorUser) {
  activeKebabId.value = null
  try {
    const updated = await updateInstructor(instructor.id, { email: instructor.email, isActive: !instructor.active })
    const idx = instructors.value.findIndex((u) => u.id === instructor.id)
    if (idx !== -1) instructors.value[idx] = { ...instructors.value[idx]!, active: updated.active }
    toast.show({ tone: 'success', title: updated.active ? 'Instructor activated' : 'Instructor deactivated' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    toast.show({ tone: 'warning', title: 'Failed to update status', body: msg || undefined })
  }
}

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
  activeKebabId.value = null
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

// const ALLOWED_DOMAINS = ['amalitech.com', 'amalitechtraining.com', 'amalitechtraining.org']

// function isAllowedDomain(email: string): boolean {
//   const domain = email.trim().toLowerCase().split('@')[1]
//   return !!domain && ALLOWED_DOMAINS.includes(domain)
// }

async function submitForm() {
  form.value.error = ''
  if (!form.value.email.trim()) {
    form.value.error = 'Email address is required.'
    return
  }
  // if (!isAllowedDomain(form.value.email)) {
  //   form.value.error = 'Email must belong to @amalitech.com, @amalitechtraining.com, or @amalitechtraining.org.'
  //   return
  // }

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
        // Show the exact backend error messages in the drawer
        const failedMessages: string[] = []
        if (profileFailed) {
          const reason = (results.profile as PromiseRejectedResult).reason
          failedMessages.push(reason instanceof Error ? reason.message : 'Profile update failed.')
        }
        if (addFailed) {
          const reason = (results.add as PromiseRejectedResult).reason
          failedMessages.push(reason instanceof Error ? reason.message : 'Module assignment failed.')
        }
        if (removeFailed) {
          const reason = (results.remove as PromiseRejectedResult).reason
          failedMessages.push(reason instanceof Error ? reason.message : 'Module removal failed.')
        }
        form.value.error = failedMessages.join(' ')
        // Sync originalIds and form so a retry only re-attempts what failed
        if (profileChanged && !profileFailed) {
          const p = (results.profile as PromiseFulfilledResult<InstructorUser>).value
          form.value.email = p.email
          form.value.isActive = p.active
        }
        if (toAdd.length && !addFailed) {
          toAdd.forEach((id) => { if (!originalIds.value.includes(id)) originalIds.value.push(id) })
        }
        if (toRemove.length && !removeFailed) {
          const removedSet = new Set(toRemove)
          originalIds.value = originalIds.value.filter((id) => !removedSet.has(id))
        }
      } else {
        toast.show({ tone: 'success', title: 'Instructor updated' })
        closeDrawer()
      }
    } else {
      // Stage 1 — create the account
      const created = await addInstructor({
        email: form.value.email.trim(),
        isActive: form.value.isActive,
      })

      // Stage 2 — assign modules (best-effort; instructor already exists if this fails)
      if (assignedIds.value.length > 0) {
        try {
          await assignInstructorModules(created.id, [...assignedIds.value])
        } catch (err) {
          console.error('[instructor:create] module-assign stage failed', err)
          toast.show({ tone: 'warning', title: 'Instructor created', body: 'Module assignment failed — edit the instructor to retry.' })
          await loadInstructors(0)
          closeDrawer()
          return
        }
      }
      await loadInstructors(0)

      toast.show({ tone: 'success', title: 'Instructor added' })
      closeDrawer()
    }
  } catch (err) {
    if (editTarget.value) {
      console.error('[instructor:update] unexpected error', err)
    } else {
      console.error('[instructor:create] account stage failed', err)
    }
    const msg = err instanceof Error ? err.message : ''
    form.value.error = msg || (editTarget.value
      ? 'Failed to update instructor. Please try again.'
      : 'Failed to create instructor. Please try again.')
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

  <!-- Table + Pagination -->
  <div v-else class="tbl-wrap">
    <!-- Toolbar -->
    <div class="tbl-toolbar">
      <span class="tb-hint">{{ totalElements }} instructor{{ totalElements === 1 ? '' : 's' }}</span>
      <div class="tb-actions">
        <VButton size="sm" variant="ghost" icon="columns-3" @click="toggleColMenu">Manage columns</VButton>
        <VButton size="sm" variant="primary" icon="download" :disabled="exporting" @click="exportCsv">Export</VButton>
      </div>
    </div>

    <table class="tbl">
      <thead>
        <tr>
          <th>Name</th>
          <th v-if="cols.email">Email</th>
          <th v-if="cols.modules" style="text-align: center">Assigned modules</th>
          <th v-if="cols.status" style="text-align: center">Status</th>
          <th style="text-align: right">Actions</th>
        </tr>
      </thead>
      <tbody v-if="isLoading">
        <tr v-for="i in 5" :key="i" class="skel-row">
          <td><span class="skel" style="width: 45%" /></td>
          <td v-if="cols.email"><span class="skel mono" style="width: 65%" /></td>
          <td v-if="cols.modules" style="text-align: center"><span class="skel" style="width: 24px; display: inline-block" /></td>
          <td v-if="cols.status" style="text-align: center"><span class="skel" style="width: 60px; border-radius: 999px; display: inline-block" /></td>
          <td style="text-align: right"><span class="skel" style="width: 32px; display: inline-block" /></td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-if="!instructors.length">
          <td :colspan="colCount" style="text-align: center; color: var(--text-secondary); padding: 32px">
            No instructors yet. Add one to get started.
          </td>
        </tr>
        <tr v-for="u in instructors" :key="u.id">
          <td style="font-weight: 600">{{ emailToName(u.email) }}</td>
          <td v-if="cols.email" class="mono" style="color: var(--text-secondary)">{{ u.email }}</td>
          <td v-if="cols.modules" style="text-align: center">
            <button
              v-if="u.assignedModules.length > 0"
              class="link"
              style="font-size: 13px; font-weight: 600"
              @click="openModules(u)"
            >{{ u.assignedModules.length }}</button>
            <span v-else style="color: var(--text-secondary)">0</span>
          </td>
          <td v-if="cols.status" style="text-align: center">
            <VPill :tone="u.active ? 'success' : 'info'" style="display: inline-flex; align-items: center; gap: 6px">
              {{ u.active ? 'Active' : 'Inactive' }}
            </VPill>
          </td>
          <td style="text-align: right">
            <button class="kebab" aria-label="Actions" @click="toggleKebab($event, u.id)">
              <VIcon name="more-vertical" :size="18" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Pagination -->
    <div v-if="!isLoading && totalElements > 0" class="pager">
      <span class="pager-count">
        Showing <span class="pg-strong">{{ showingFrom }}</span> to <span class="pg-strong">{{ showingTo }}</span> of <span class="pg-strong">{{ totalElements }}</span> Entries
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

  <!-- View Modules Drawer -->
  <VDrawer
    :open="showModulesDrawer"
    title="Assigned modules"
    :subtitle="modulesTarget ? emailToName(modulesTarget.email) : ''"
    @close="closeModulesDrawer"
  >
    <div v-if="!groupedModules.length" style="color: var(--text-secondary); font-size: 14px; padding: 8px 0">
      No modules assigned.
    </div>
    <div v-for="group in groupedModules" :key="group.spec" class="mg">
      <div class="mg-head">
        <span class="mg-spec">{{ group.spec }}</span>
      </div>
      <div
        v-for="mod in group.modules"
        :key="mod"
        class="mg-row"
        style="cursor: default; pointer-events: none"
      >
        <VIcon name="book-open" :size="14" style="color: var(--text-secondary); flex-shrink: 0" />
        <span>{{ mod }}</span>
      </div>
    </div>
    <template #footer>
      <VButton variant="ghost" @click="closeModulesDrawer">Close</VButton>
    </template>
  </VDrawer>

  <!-- Add / Edit Drawer -->
  <VDrawer :open="showDrawer" :title="drawerTitle" :subtitle="drawerSubtitle" :error="form.error || undefined" @close="closeDrawer">
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

    <template #footer>
      <VButton variant="ghost" @click="closeDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submitForm">
        {{ editTarget ? 'Save changes' : 'Add instructor' }}
      </VButton>
    </template>
  </VDrawer>

  <!-- Manage columns popover -->
  <Teleport to="body">
    <div v-if="showColMenu && colMenuPos" class="pop col-pop" :style="{ top: `${colMenuPos.top}px`, left: `${colMenuPos.left}px` }" @click.stop>
      <p class="pop-title">Manage columns</p>
      <label v-for="c in COL_LABELS" :key="c.key" class="pop-row">
        <input type="checkbox" v-model="cols[c.key]" />
        {{ c.label }}
      </label>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="activeKebabInstructor && kebabPos"
      :style="{
        position: 'fixed',
        top: `${kebabPos.top}px`,
        left: `${kebabPos.left}px`,
        zIndex: 1000,
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-pop)',
        minWidth: '160px',
        overflow: 'hidden',
      }"
      @click.stop
    >
      <button
        style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 16px; border: none; background: none; font-family: inherit; font-size: 14px; color: var(--text); cursor: pointer; text-align: left"
        @mouseenter="($event.target as HTMLElement).style.background = 'var(--bg)'"
        @mouseleave="($event.target as HTMLElement).style.background = 'none'"
        @click="openEdit(activeKebabInstructor)"
      >
        <VIcon name="pencil" :size="15" style="color: var(--text-secondary)" />
        Edit
      </button>
      <button
        style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 16px; border: none; background: none; font-family: inherit; font-size: 14px; color: var(--text); cursor: pointer; text-align: left"
        @mouseenter="($event.target as HTMLElement).style.background = 'var(--bg)'"
        @mouseleave="($event.target as HTMLElement).style.background = 'none'"
        @click="toggleStatus(activeKebabInstructor)"
      >
        <VIcon :name="activeKebabInstructor.active ? 'user-x' : 'user-check'" :size="15" style="color: var(--text-secondary)" />
        {{ activeKebabInstructor.active ? 'Deactivate' : 'Activate' }}
      </button>
    </div>
  </Teleport>
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
