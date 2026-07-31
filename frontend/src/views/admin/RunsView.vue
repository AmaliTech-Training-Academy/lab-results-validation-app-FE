<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import { useRunsStore } from '@/stores/runs'
import { useCohortsStore } from '@/stores/cohorts'
import { useToastStore } from '@/stores/toast'
import type { IngestionRun, RunStatus } from '@/types/run.types'
import { RUN_STATUS_TONE } from '@/types/run.types'

const router = useRouter()
const runs = useRunsStore()
const cohorts = useCohortsStore()
const toast = useToastStore()

const selectedCohortId = ref('')

onMounted(() => {
  runs.fetchList()
  cohorts.fetchList()
})

/** Only STOOD_UP (incl. locked) cohorts are sync-eligible (B2 AC1). */
const eligibleCohorts = computed(() => cohorts.list.filter((c) => c.lifecycleState === 'STOOD_UP'))

const displayed = computed(() =>
  selectedCohortId.value ? runs.list.filter((r) => r.cohortId === selectedCohortId.value) : runs.list,
)

const STATUS_LABEL: Record<RunStatus, string> = {
  completed: 'Completed',
  partial: 'Partial',
  failed: 'Failed',
  skipped: 'Skipped',
  processing: 'Processing',
}

function triggerLabel(r: IngestionRun): string {
  if (!r.triggerType) return '—'
  const who = r.triggerType === 'SCHEDULED' ? 'System' : r.triggeredByEmail ?? r.triggeredBy ?? 'Admin'
  return `${r.triggerType === 'SCHEDULED' ? 'Scheduled' : 'Manual'} · ${who}`
}

function fmtWhen(iso?: string): string {
  return iso ? iso.replace('T', ' ').slice(0, 16) : '—'
}

async function runSync() {
  try {
    await runs.sync(selectedCohortId.value || undefined)
    toast.show({ tone: 'success', title: 'Sync triggered', body: 'A new run has started.' })
  } catch {
    toast.show({ tone: 'warning', title: 'Sync failed', body: runs.error ?? 'Please try again.' })
  }
}

function openRun(r: IngestionRun) {
  router.push({ name: 'admin-run-review', params: { id: r.id }, query: { cohortId: r.cohortId } })
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1 class="page-title">Grading runs</h1>
      <p class="page-sub">SharePoint grading ingestion — scheduled weekly and on demand.</p>
    </div>
    <div class="head-actions">
      <select v-model="selectedCohortId" class="cohort-select" aria-label="Filter by cohort">
        <option value="">All cohorts</option>
        <option v-for="c in eligibleCohorts" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <VButton variant="primary" icon="refresh-cw" :disabled="runs.syncing" @click="runSync">
        {{ runs.syncing ? 'Syncing…' : selectedCohortId ? 'Sync cohort' : 'Run sync now' }}
      </VButton>
    </div>
  </div>

  <div v-if="runs.error && !runs.loading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load runs</p>
    <p class="load-error-sub">{{ runs.error }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="runs.fetchList()">Try again</VButton>
  </div>

  <div v-else class="tbl-wrap">
    <table class="tbl">
      <thead>
        <tr>
          <th>File</th>
          <th>Cohort</th>
          <th>Trigger</th>
          <th style="text-align: center">Status</th>
          <th>Results</th>
          <th>When</th>
          <th aria-hidden="true"></th>
        </tr>
      </thead>

      <tbody v-if="runs.loading">
        <tr v-for="i in 4" :key="i">
          <td><span class="skel" style="width: 70%" /></td>
          <td><span class="skel" style="width: 60%" /></td>
          <td><span class="skel" style="width: 50%" /></td>
          <td style="text-align: center"><span class="skel" style="width: 64px; border-radius: 999px" /></td>
          <td><span class="skel" style="width: 80%" /></td>
          <td><span class="skel mono" style="width: 90px" /></td>
          <td></td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-for="r in displayed" :key="r.id" class="row-click" @click="openRun(r)">
          <td class="mono file-cell">
            {{ r.workbookFilename ?? '—' }}
            <VIcon v-if="r.highFailure" name="alert-triangle" :size="14" class="hi-fail" aria-label="High failure rate" />
          </td>
          <td>{{ r.cohortName ?? '—' }}</td>
          <td class="muted">{{ triggerLabel(r) }}</td>
          <td style="text-align: center"><VPill :tone="RUN_STATUS_TONE[r.status]">{{ STATUS_LABEL[r.status] }}</VPill></td>
          <td>
            <span class="counts mono">
              <span class="c-new">{{ r.counts?.committedNew ?? 0 }} new</span>
              <span class="sep">·</span>
              <span>{{ r.counts?.updated ?? 0 }} upd</span>
              <span class="sep">·</span>
              <span :class="{ 'c-bad': (r.counts?.skippedInvalid ?? 0) > 0 }">{{ r.counts?.skippedInvalid ?? 0 }} invalid</span>
              <span class="sep">·</span>
              <span :class="{ 'c-conflict': (r.counts?.conflicts ?? 0) > 0 }">{{ r.counts?.conflicts ?? 0 }} conflict</span>
            </span>
          </td>
          <td class="mono muted">{{ fmtWhen(r.runAt ?? r.startedAt) }}</td>
          <td style="text-align: right; width: 44px"><VIcon name="chevron-right" :size="18" class="muted" /></td>
        </tr>

        <tr v-if="displayed.length === 0">
          <td colspan="7">
            <div class="empty-inline">
              <VIcon name="refresh-cw" :size="26" class="muted" />
              <p class="empty-title">No runs yet</p>
              <p class="empty-sub">Trigger a sync to ingest grading data for a stood-up cohort.</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.page-sub {
  color: var(--text-secondary);
  font-size: 14px;
  margin-top: 4px;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cohort-select {
  height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm, 4px);
  background: #fff;
  padding: 0 12px;
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}
.cohort-select:focus-visible {
  outline: none;
  border-color: var(--orange);
  box-shadow: var(--ring-focus);
}
.row-click {
  cursor: pointer;
}
.muted {
  color: var(--text-secondary);
}
.file-cell {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}
.hi-fail {
  color: var(--warning, #b45309);
  flex-shrink: 0;
}
.counts {
  font-size: 12.5px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.counts .sep {
  margin: 0 5px;
  opacity: 0.5;
}
.c-new {
  color: var(--success);
}
.c-bad {
  color: var(--danger);
}
.c-conflict {
  color: var(--warning, #b45309);
  font-weight: 600;
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
}
.empty-sub {
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
