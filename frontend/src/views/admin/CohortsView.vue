<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VDrawer from '@/components/base/VDrawer.vue'
import VDatePicker from '@/components/base/VDatePicker.vue'
import { useCohortsStore } from '@/stores/cohorts'
import { useToastStore } from '@/stores/toast'
import { cohortDisplayState, type Cohort, type CohortDisplayState } from '@/types/domain.types'

const router = useRouter()
const store = useCohortsStore()
const toast = useToastStore()

onMounted(() => store.fetchList())

// ── State chip ────────────────────────────────────────────────────────────────
const CHIP: Record<CohortDisplayState, { tone: 'info' | 'warning' | 'success'; label: string }> = {
  DRAFT: { tone: 'info', label: 'Draft' },
  REFERENCE_ACCEPTED: { tone: 'warning', label: 'Reference accepted' },
  STOOD_UP: { tone: 'success', label: 'Stood up' },
  LOCKED: { tone: 'success', label: 'Locked' },
}
const chipFor = (c: Cohort) => CHIP[cohortDisplayState(c)]

// ── Row navigation: DRAFT/REFERENCE_ACCEPTED → stand-up; STOOD_UP → detail ──────
function openCohort(c: Cohort) {
  const name = c.lifecycleState === 'STOOD_UP' ? 'admin-cohort-detail' : 'admin-cohort-standup'
  router.push({ name, params: { id: c.id } })
}

// ── Create drawer ──────────────────────────────────────────────────────────────
const showDrawer = ref(false)
const submitting = ref(false)
const form = ref({ name: '', startDate: '', endDate: '' })
const formError = ref('')

const dateRangeError = computed(() => {
  if (!form.value.startDate || !form.value.endDate) return ''
  return form.value.endDate < form.value.startDate ? 'End date must be after start date.' : ''
})

function openCreate() {
  form.value = { name: '', startDate: '', endDate: '' }
  formError.value = ''
  showDrawer.value = true
}

function closeDrawer() {
  showDrawer.value = false
}

async function submit() {
  formError.value = ''
  if (!form.value.name.trim() || !form.value.startDate || !form.value.endDate) {
    formError.value = 'Name, start date, and end date are required.'
    return
  }
  if (dateRangeError.value) {
    formError.value = dateRangeError.value
    return
  }
  submitting.value = true
  try {
    const cohort = await store.createCohort({
      name: form.value.name.trim(),
      startDate: form.value.startDate,
      endDate: form.value.endDate,
    })
    toast.show({ tone: 'success', title: 'Cohort created', body: 'Point it at a SharePoint folder to begin stand-up.' })
    showDrawer.value = false
    router.push({ name: 'admin-cohort-standup', params: { id: cohort.id } })
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Failed to create cohort. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1 class="page-title">Cohorts</h1>
      <p class="page-sub">Create a cohort, point it at its SharePoint folder, and run stand-up.</p>
    </div>
    <VButton variant="primary" icon="plus" @click="openCreate">New cohort</VButton>
  </div>

  <!-- Error state -->
  <div v-if="store.error && !store.loading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load cohorts</p>
    <p class="load-error-sub">{{ store.error }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="store.fetchList()">Try again</VButton>
  </div>

  <div v-else class="tbl-wrap">
    <table class="tbl">
      <thead>
        <tr>
          <th>Cohort name</th>
          <th>Start date</th>
          <th>End date</th>
          <th style="text-align: center">State</th>
          <th aria-hidden="true"></th>
        </tr>
      </thead>

      <tbody v-if="store.loading">
        <tr v-for="i in 4" :key="i" class="skel-row">
          <td><span class="skel" style="width: 55%" /></td>
          <td><span class="skel mono" style="width: 80px" /></td>
          <td><span class="skel mono" style="width: 80px" /></td>
          <td style="text-align: center"><span class="skel" style="width: 64px; border-radius: 999px" /></td>
          <td></td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-for="c in store.list" :key="c.id" class="row-click" @click="openCohort(c)">
          <td style="font-weight: 600">
            <span class="cohort-name">
              {{ c.name }}
              <VIcon v-if="c.locked" name="lock" :size="13" class="lock-icon" aria-label="Locked" />
            </span>
          </td>
          <td class="mono muted">{{ c.startDate }}</td>
          <td class="mono muted">{{ c.endDate }}</td>
          <td style="text-align: center">
            <VPill :tone="chipFor(c).tone">{{ chipFor(c).label }}</VPill>
          </td>
          <td style="text-align: right; width: 44px">
            <VIcon name="chevron-right" :size="18" class="muted" />
          </td>
        </tr>

        <tr v-if="store.list.length === 0">
          <td colspan="5">
            <div class="empty-inline">
              <VIcon name="layers" :size="28" class="muted" />
              <p class="empty-title">No cohorts yet</p>
              <p class="empty-sub">Create a cohort to begin standing it up.</p>
              <VButton variant="primary" icon="plus" @click="openCreate">New cohort</VButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Create drawer -->
  <VDrawer
    :open="showDrawer"
    title="New cohort"
    subtitle="A cohort is a time-bound group of learners. It starts as a draft — you'll add its SharePoint link next."
    :error="formError || undefined"
    @close="closeDrawer"
  >
    <label class="ff">
      <span class="ff-label">Cohort name <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="form.name" placeholder="e.g. Cohort 9 — Spring 2026" />
      </span>
    </label>
    <div class="ff-row">
      <VDatePicker v-model="form.startDate" label="Start date" required :max="form.endDate || undefined" />
      <VDatePicker v-model="form.endDate" label="End date" required :min="form.startDate || undefined" :error="dateRangeError" />
    </div>
    <template #footer>
      <VButton variant="ghost" @click="closeDrawer">Cancel</VButton>
      <VButton variant="primary" :disabled="submitting" @click="submit">
        {{ submitting ? 'Creating…' : 'Create cohort' }}
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
.row-click {
  cursor: pointer;
}
.cohort-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.lock-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}
.muted {
  color: var(--text-secondary);
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
