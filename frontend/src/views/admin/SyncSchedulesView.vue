<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import VToggle from '@/components/base/VToggle.vue'
import { useSyncSchedulesStore } from '@/stores/syncSchedules'
import { useCohortsStore } from '@/stores/cohorts'
import { useToastStore } from '@/stores/toast'
import { toErrorMessage } from '@/utils/errors'
import type { DayOfWeekName, ScheduleFrequency, SyncSchedulePayload, SyncScheduleResponse } from '@/types/syncSchedule.types'

const store = useSyncSchedulesStore()
const cohorts = useCohortsStore()
const toast = useToastStore()

const loading = computed(() => store.loading || cohorts.loading)

onMounted(() => {
  store.fetchList()
  cohorts.fetchList()
})

const FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
]

const DAYS: DayOfWeekName[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

// Common offerings only — an unrecognized value from the server (e.g. an
// engagement-specific zone) still round-trips correctly on save even if it
// doesn't match one of these options for display.
const TIMEZONES = ['GMT', 'UTC', 'Africa/Accra', 'Europe/London']

function dayLabel(d: string): string {
  return d.charAt(0) + d.slice(1).toLowerCase()
}

function cohortName(cohortId: string | null): string {
  if (cohortId === null) return 'All eligible cohorts'
  return cohorts.list.find((c) => c.id === cohortId)?.name ?? cohortId
}

function frequencyLabel(s: SyncScheduleResponse): string {
  return s.frequency === 'WEEKLY' ? `Weekly · ${dayLabel(s.dayOfWeek ?? '')}` : 'Daily'
}

function timeLabel(s: SyncScheduleResponse): string {
  return `${s.timeOfDay.slice(0, 5)} ${s.timezone}`
}

// ── Row actions ──────────────────────────────────────────────────────────────
function payloadFromRow(s: SyncScheduleResponse): SyncSchedulePayload {
  return {
    name: s.name,
    cohortId: s.cohortId ?? undefined,
    frequency: s.frequency,
    timeOfDay: s.timeOfDay,
    dayOfWeek: s.dayOfWeek ?? undefined,
    timezone: s.timezone,
    enabled: s.enabled,
  }
}

async function toggleEnabled(s: SyncScheduleResponse) {
  try {
    await store.update(s.id, { ...payloadFromRow(s), enabled: !s.enabled })
    toast.show({ tone: 'success', title: s.enabled ? 'Sync schedule paused' : 'Sync schedule enabled' })
  } catch {
    toast.show({ tone: 'warning', title: 'Could not update sync schedule', body: store.error ?? 'Please try again.' })
  }
}

async function onDelete(s: SyncScheduleResponse) {
  if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return
  try {
    await store.remove(s.id)
    toast.show({ tone: 'success', title: 'Sync schedule deleted' })
  } catch {
    toast.show({ tone: 'warning', title: 'Could not delete sync schedule', body: store.error ?? 'Please try again.' })
  }
}

// ── Create / edit drawer ─────────────────────────────────────────────────────
const showDrawer = ref(false)
const submitting = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')
const form = ref({
  name: '',
  cohortId: '',
  frequency: 'WEEKLY' as ScheduleFrequency,
  dayOfWeek: 'MONDAY' as DayOfWeekName,
  timeOfDay: '08:00',
  timezone: '',
  enabled: true,
})

const drawerTitle = computed(() => (editingId.value ? 'Edit sync schedule' : 'New sync schedule'))

function openCreate() {
  editingId.value = null
  form.value = { name: '', cohortId: '', frequency: 'WEEKLY', dayOfWeek: 'MONDAY', timeOfDay: '08:00', timezone: '', enabled: true }
  formError.value = ''
  showDrawer.value = true
}

function openEdit(s: SyncScheduleResponse) {
  editingId.value = s.id
  form.value = {
    name: s.name,
    cohortId: s.cohortId ?? '',
    frequency: s.frequency,
    dayOfWeek: s.dayOfWeek ?? 'MONDAY',
    timeOfDay: s.timeOfDay.slice(0, 5),
    timezone: s.timezone,
    enabled: s.enabled,
  }
  formError.value = ''
  showDrawer.value = true
}

function closeDrawer() {
  showDrawer.value = false
}

async function submit() {
  formError.value = ''
  if (!form.value.name.trim() || !form.value.timeOfDay) {
    formError.value = 'Name and time of day are required.'
    return
  }
  if (form.value.frequency === 'WEEKLY' && !form.value.dayOfWeek) {
    formError.value = 'Day of week is required for a weekly schedule.'
    return
  }

  const payload: SyncSchedulePayload = {
    name: form.value.name.trim(),
    cohortId: form.value.cohortId || undefined,
    frequency: form.value.frequency,
    timeOfDay: form.value.timeOfDay,
    dayOfWeek: form.value.frequency === 'WEEKLY' ? form.value.dayOfWeek : undefined,
    timezone: form.value.timezone || undefined,
    enabled: form.value.enabled,
  }

  submitting.value = true
  try {
    if (editingId.value) {
      await store.update(editingId.value, payload)
      toast.show({ tone: 'success', title: 'Sync schedule updated' })
    } else {
      await store.create(payload)
      toast.show({ tone: 'success', title: 'Sync schedule created' })
    }
    showDrawer.value = false
  } catch (e) {
    formError.value = toErrorMessage(e, 'Failed to save sync schedule. Please try again.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1 class="page-title">Sync schedules</h1>
      <p class="page-sub">Recurring schedules that trigger score-sheet sync runs, per cohort or across all eligible cohorts.</p>
    </div>
    <VButton variant="primary" icon="plus" @click="openCreate">New schedule</VButton>
  </div>

  <!-- Error state -->
  <div v-if="store.error && !store.loading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load sync schedules</p>
    <p class="load-error-sub">{{ store.error }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="store.fetchList()">Try again</VButton>
  </div>

  <div v-else class="tbl-wrap">
    <table class="tbl">
      <thead>
        <tr>
          <th>Name</th>
          <th>Cohort</th>
          <th>Frequency</th>
          <th>Time</th>
          <th style="text-align: center">Enabled</th>
          <th aria-hidden="true"></th>
        </tr>
      </thead>

      <tbody v-if="loading">
        <tr v-for="i in 4" :key="i" class="skel-row">
          <td><span class="skel" style="width: 55%" /></td>
          <td><span class="skel" style="width: 65%" /></td>
          <td><span class="skel" style="width: 60%" /></td>
          <td><span class="skel mono" style="width: 70px" /></td>
          <td style="text-align: center"><span class="skel" style="width: 40px; border-radius: 999px" /></td>
          <td></td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-for="s in store.list" :key="s.id">
          <td style="font-weight: 600">{{ s.name }}</td>
          <td>
            <VPill v-if="s.cohortId === null" tone="info">All eligible cohorts</VPill>
            <span v-else>{{ cohortName(s.cohortId) }}</span>
          </td>
          <td>{{ frequencyLabel(s) }}</td>
          <td class="mono muted">{{ timeLabel(s) }}</td>
          <td style="text-align: center">
            <VToggle :model-value="s.enabled" @update:model-value="toggleEnabled(s)" />
          </td>
          <td class="row-actions">
            <button class="icon-btn" type="button" aria-label="Edit schedule" @click="openEdit(s)">
              <VIcon name="pencil" :size="16" />
            </button>
            <button class="icon-btn icon-btn--danger" type="button" aria-label="Delete schedule" @click="onDelete(s)">
              <VIcon name="trash-2" :size="16" />
            </button>
          </td>
        </tr>

        <tr v-if="store.list.length === 0">
          <td colspan="6">
            <div class="empty-inline">
              <VIcon name="calendar" :size="28" class="muted" />
              <p class="empty-title">No sync schedules yet</p>
              <p class="empty-sub">Create a schedule to automate grading sheet ingestion.</p>
              <VButton variant="primary" icon="plus" @click="openCreate">New schedule</VButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Create / edit drawer -->
  <VDrawer
    :open="showDrawer"
    :title="drawerTitle"
    subtitle="Omit a cohort to run the same batch as a manual sync-all."
    :error="formError || undefined"
    @close="closeDrawer"
  >
    <label class="ff">
      <span class="ff-label">Name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="form.name" placeholder="e.g. Nightly sync — all cohorts" />
      </span>
    </label>

    <label class="ff">
      <span class="ff-label">Cohort</span>
      <span class="ff-input">
        <select v-model="form.cohortId">
          <option value="">All eligible cohorts</option>
          <option v-for="c in cohorts.list" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </span>
    </label>

    <div class="ff-row">
      <label class="ff">
        <span class="ff-label">Frequency <span style="color: var(--danger)">*</span></span>
        <span class="ff-input">
          <select v-model="form.frequency">
            <option v-for="f in FREQUENCIES" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </span>
      </label>
      <label v-if="form.frequency === 'WEEKLY'" class="ff">
        <span class="ff-label">Day of week <span style="color: var(--danger)">*</span></span>
        <span class="ff-input">
          <select v-model="form.dayOfWeek">
            <option v-for="d in DAYS" :key="d" :value="d">{{ dayLabel(d) }}</option>
          </select>
        </span>
      </label>
    </div>

    <div class="ff-row">
      <label class="ff">
        <span class="ff-label">Time of day <span style="color: var(--danger)">*</span></span>
        <span class="ff-input">
          <input v-model="form.timeOfDay" type="time" class="mono" />
        </span>
      </label>
      <label class="ff">
        <span class="ff-label">Timezone</span>
        <span class="ff-input">
          <select v-model="form.timezone">
            <option value="">Use default</option>
            <option v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz }}</option>
          </select>
        </span>
      </label>
    </div>

    <div class="ff">
      <span class="ff-label">Enabled</span>
      <VToggle v-model="form.enabled" active-color="success" />
    </div>

    <template #footer>
      <VButton variant="ghost" @click="closeDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submit">
        {{ submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create schedule' }}
      </VButton>
    </template>
  </VDrawer>
</template>

<style scoped>
.page-sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 4px;
}
.muted {
  color: var(--text-secondary);
}
.ff-input select {
  border: none;
  outline: none;
  flex: 1;
  height: 100%;
  font-family: inherit;
  font-size: 15px;
  color: var(--text);
  background: transparent;
  min-width: 0;
}
.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  white-space: nowrap;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover {
  background: var(--surface-alt);
  color: var(--text);
}
.icon-btn--danger:hover {
  background: var(--danger-bg);
  color: var(--danger);
}
.empty-inline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 16px;
  text-align: center;
}
.empty-title {
  font-weight: 600;
  color: var(--text);
}
.empty-sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 8px;
}
</style>
