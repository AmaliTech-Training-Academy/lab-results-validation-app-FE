<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import { useCohortsStore } from '@/stores/cohorts'
import { useStandupStore } from '@/stores/standup'
import { useToastStore } from '@/stores/toast'
import { useJobPolling } from '@/composables/useJobPolling'
import type { GateStatus } from '@/types/standup.types'
import type { LocatedError } from '@/types/common.types'

const route = useRoute()
const router = useRouter()
const cohorts = useCohortsStore()
const standup = useStandupStore()
const toast = useToastStore()

const cohortId = route.params.id as string
const linkInput = ref('')
const localError = ref('')

const cohort = computed(() => cohorts.current)

const polling = useJobPolling(() => standup.refresh(cohortId), {
  intervalMs: 1500,
  onTerminal: (s) => {
    if (s.gates.find((g) => g.id === 'gate4')?.status === 'passed') {
      toast.show({ tone: 'success', title: 'Cohort stood up', body: 'Reference data committed and score sheets validated.' })
      router.replace({ name: 'admin-cohort-detail', params: { id: cohortId } })
    }
  },
})

const status = polling.status
const gates = computed(() => status.value?.gates ?? [])
const gate = (id: string) => gates.value.find((g) => g.id === id)
const failedGate = computed(() => gates.value.find((g) => g.status === 'failed'))
const gate3Passed = computed(() => gate('gate3')?.status === 'passed')
const accepted = computed(() => gate('accept')?.status === 'passed')
const awaitingAccept = computed(() => gate3Passed.value && !accepted.value && !failedGate.value)
const summary = computed(() => status.value?.acceptSummary)
const started = computed(() => status.value !== null)

onMounted(async () => {
  await cohorts.fetchCohort(cohortId)
  if (cohort.value?.lifecycleState === 'STOOD_UP') {
    router.replace({ name: 'admin-cohort-detail', params: { id: cohortId } })
    return
  }
  linkInput.value = cohort.value?.sharepointFolderUrl ?? ''
})

async function runValidation() {
  localError.value = ''
  if (!linkInput.value.trim()) {
    localError.value = 'Enter the SharePoint folder link.'
    return
  }
  await standup.start(cohortId, linkInput.value.trim())
  polling.start()
}

async function accept() {
  await standup.accept(cohortId)
  await cohorts.fetchCohort(cohortId)
  polling.start() // resume polling for Gate 4
}

async function discard() {
  await standup.discard(cohortId)
  polling.stop()
  standup.reset()
  await cohorts.fetchCohort(cohortId)
  toast.show({ tone: 'info', title: 'Reset to draft', body: 'Committed reference data was cleared. Resubmit the link to redo.' })
}

function startOver() {
  polling.stop()
  standup.reset()
  localError.value = ''
}

const SUMMARY_ROWS = [
  { key: 'specializations', label: 'Specializations' },
  { key: 'modules', label: 'Modules' },
  { key: 'labs', label: 'Labs' },
  { key: 'learners', label: 'Learners' },
  { key: 'instructors', label: 'Instructor contacts' },
] as const

const STEP_ICON: Record<GateStatus, string> = {
  pending: 'circle',
  running: 'loader',
  passed: 'check-circle-2',
  failed: 'x-circle',
  not_run: 'minus-circle',
}
const STEP_LABEL: Record<GateStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  not_run: 'Not run',
}

function fmtError(e: LocatedError): string {
  const loc = [e.file, e.sheet, e.row != null ? `row ${e.row}` : '', e.rule].filter(Boolean).join(' · ')
  return loc ? `${loc} — ${e.message}` : e.message
}
</script>

<template>
  <div class="page-head">
    <div>
      <RouterLink :to="{ name: 'admin-cohorts' }" class="back-link">
        <VIcon name="chevron-left" :size="15" /> Cohorts
      </RouterLink>
      <h1 class="page-title">Cohort stand-up</h1>
      <p class="page-sub">{{ cohort?.name ?? '…' }}</p>
    </div>
  </div>

  <!-- Intake: submit the SharePoint folder link -->
  <section v-if="!started && cohort?.lifecycleState !== 'REFERENCE_ACCEPTED'" class="card">
    <h2 class="card-title">SharePoint folder link</h2>
    <p class="card-sub">
      Paste the link to the cohort folder. LabGate validates it in four gates before anything is committed.
    </p>
    <label class="ff">
      <span class="ff-label">Folder link <span style="color: var(--danger)">*</span></span>
      <span class="ff-input">
        <input v-model="linkInput" placeholder="https://…sharepoint.com/sites/labgate/Cohort9" />
      </span>
    </label>
    <p v-if="localError" class="inline-error"><VIcon name="alert-circle" :size="14" /> {{ localError }}</p>
    <div class="card-actions">
      <VButton variant="primary" icon-right="arrow-right" :disabled="standup.busy" @click="runValidation">
        {{ standup.busy ? 'Starting…' : 'Run validation' }}
      </VButton>
    </div>
  </section>

  <!-- Resumable REFERENCE_ACCEPTED state (opened fresh) -->
  <section v-else-if="!started && cohort?.lifecycleState === 'REFERENCE_ACCEPTED'" class="card">
    <div class="accepted-head">
      <VIcon name="check-circle-2" :size="20" class="ic-success" />
      <div>
        <h2 class="card-title">Reference data accepted</h2>
        <p class="card-sub">This cohort's reference bundle is committed and frozen. Continue by re-running, or discard to redo.</p>
      </div>
    </div>
    <div class="card-actions">
      <VButton variant="ghost" icon="rotate-ccw" @click="discard">Discard / reset</VButton>
      <VButton variant="primary" icon-right="arrow-right" @click="runValidation">Re-run stand-up</VButton>
    </div>
  </section>

  <!-- Live gate stepper -->
  <section v-else class="card">
    <div class="stepper">
      <div v-for="g in gates" :key="g.id" :class="['step', `step--${g.status}`]">
        <span class="step-ic"><VIcon :name="STEP_ICON[g.status]" :size="20" :class="{ spin: g.status === 'running' }" /></span>
        <span class="step-label">{{ g.label }}</span>
        <span :class="['step-state', `state--${g.status}`]">{{ STEP_LABEL[g.status] }}</span>
      </div>
    </div>

    <p v-if="polling.isPolling.value" class="polling-note">
      <VIcon name="loader" :size="14" class="spin" /> Validating…
    </p>

    <!-- Failure: full error list + retry -->
    <div v-if="failedGate" class="panel panel--error">
      <div class="panel-head">
        <VIcon name="alert-triangle" :size="18" />
        <strong>{{ failedGate.label }} failed</strong>
      </div>
      <ul class="err-list">
        <li v-for="(e, i) in failedGate.errors" :key="i" class="err-item mono">{{ fmtError(e) }}</li>
      </ul>
      <p class="panel-note">Fix the source data in SharePoint, then retry — or change the link and start over.</p>
      <div class="card-actions">
        <VButton variant="ghost" icon="pencil" @click="startOver">Change link</VButton>
        <VButton variant="primary" icon="rotate-ccw" :disabled="standup.busy" @click="runValidation">Retry validation</VButton>
      </div>
    </div>

    <!-- Awaiting Accept: summary + explicit Accept -->
    <div v-else-if="awaitingAccept" class="panel panel--accept">
      <div class="panel-head">
        <VIcon name="clipboard-check" :size="18" class="ic-success" />
        <strong>Reference data validated — review and accept</strong>
      </div>
      <p class="panel-note">Accepting commits the reference hierarchy in one transaction and freezes it for the cohort's life.</p>
      <dl class="summary" v-if="summary">
        <div v-for="row in SUMMARY_ROWS" :key="row.key" class="summary-cell">
          <dt>{{ row.label }}</dt>
          <dd class="mono">{{ summary[row.key] }}</dd>
        </div>
      </dl>
      <div class="card-actions">
        <VButton variant="ghost" @click="startOver">Cancel</VButton>
        <VButton variant="primary" icon="check" :disabled="standup.busy" @click="accept">
          {{ standup.busy ? 'Accepting…' : 'Accept reference data' }}
        </VButton>
      </div>
    </div>

    <!-- Accepted, Gate 4 running -->
    <div v-else-if="accepted && !polling.isPolling.value" class="panel panel--info">
      <div class="panel-head">
        <VIcon name="check-circle-2" :size="18" class="ic-success" />
        <strong>Reference data accepted</strong>
      </div>
      <div class="card-actions">
        <VButton variant="ghost" icon="rotate-ccw" @click="discard">Discard / reset</VButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page-sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 4px;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}
.back-link:hover {
  color: var(--navy);
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg, 8px);
  box-shadow: var(--shadow-card);
  padding: 24px;
  max-width: 720px;
}
.card-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 18px;
  color: var(--text);
}
.card-sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 4px 0 20px;
}
.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
.inline-error {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--danger);
  font-size: 13px;
  margin-top: 8px;
}

/* Stepper */
.stepper {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-radius: var(--r-sm, 4px);
  border-left: 3px solid transparent;
}
.step--running {
  background: rgba(255, 90, 0, 0.05);
  border-left-color: var(--orange);
}
.step--passed .step-ic {
  color: var(--success);
}
.step--failed {
  background: var(--danger-bg);
  border-left-color: var(--danger);
}
.step--failed .step-ic {
  color: var(--danger);
}
.step--running .step-ic {
  color: var(--orange);
}
.step--pending .step-ic,
.step--not_run .step-ic {
  color: var(--text-secondary);
  opacity: 0.6;
}
.step-label {
  flex: 1;
  font-weight: 500;
  color: var(--text);
}
.step--not_run .step-label {
  color: var(--text-secondary);
}
.step-state {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.state--passed {
  color: var(--success);
}
.state--failed {
  color: var(--danger);
}
.state--running {
  color: var(--orange);
}

.polling-note {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  margin: 12px 4px 0;
}

/* Panels */
.panel {
  margin-top: 20px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm, 4px);
  padding: 16px;
}
.panel--error {
  border-color: rgba(163, 45, 45, 0.3);
  background: var(--danger-bg);
}
.panel--accept {
  border-left: 4px solid var(--orange);
  background: rgba(255, 90, 0, 0.04);
}
.panel--info {
  border-left: 4px solid var(--success);
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.panel-note {
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 12px;
}
.err-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px 0;
}
.err-item {
  font-size: 12.5px;
  color: var(--danger);
  background: rgba(255, 255, 255, 0.5);
  padding: 6px 10px;
  border-radius: 3px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin: 8px 0;
}
.summary-cell {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--r-sm, 4px);
  padding: 12px;
}
.summary-cell dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}
.summary-cell dd {
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
  margin-top: 2px;
}

.accepted-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.ic-success {
  color: var(--success);
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
