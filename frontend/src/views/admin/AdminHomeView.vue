<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VStatCard from '@/components/base/VStatCard.vue'
import VPill from '@/components/base/VPill.vue'
import VIcon from '@/components/base/VIcon.vue'
import VButton from '@/components/base/VButton.vue'
import { useCohortsStore } from '@/stores/cohorts'
import { useRunsStore } from '@/stores/runs'
import type { IngestionRun, RunStatus } from '@/types/run.types'
import '@/assets/styles/dashboard.css'

const router = useRouter()
const cohorts = useCohortsStore()
const runs = useRunsStore()

const loading = computed(() => cohorts.loading || runs.loading)
const error = computed(() => cohorts.error || runs.error)

onMounted(() => {
  cohorts.fetchList()
  runs.fetchList()
})

// ── Cohorts by state ────────────────────────────────────────────────────────
const cohortCounts = computed(() => {
  const l = cohorts.list
  return {
    total: l.length,
    draft: l.filter((c) => c.lifecycleState === 'DRAFT').length,
    refAccepted: l.filter((c) => c.lifecycleState === 'REFERENCE_ACCEPTED').length,
    stoodUp: l.filter((c) => c.lifecycleState === 'STOOD_UP' && !c.locked).length,
    locked: l.filter((c) => c.lifecycleState === 'STOOD_UP' && c.locked).length,
  }
})

// ── Runs ────────────────────────────────────────────────────────────────────
const recentRuns = computed(() => runs.list.slice(0, 5))
const attentionRuns = computed(() =>
  runs.list.filter((r) => r.highFailure || r.status === 'partial' || r.status === 'failed'),
)
const openConflicts = computed(() => runs.list.reduce((n, r) => n + (r.counts?.conflicts ?? 0), 0))

const RUN_TONE: Record<RunStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  completed: 'success', partial: 'warning', failed: 'danger', skipped: 'info', processing: 'info',
}

function rejectPct(r: IngestionRun): number {
  const rowsRead = r.counts?.rowsRead ?? 0
  return rowsRead > 0 ? Math.round(((r.counts?.skippedInvalid ?? 0) / rowsRead) * 100) : 0
}
function fmt(iso?: string): string {
  return iso ? iso.replace('T', ' ').slice(0, 16) : '—'
}
function openRun(r: IngestionRun) {
  router.push({ name: 'admin-run-review', params: { id: r.id } })
}
</script>

<template>
  <div class="dash">
    <div class="page-head">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">Cohort stand-up progress and grading ingestion at a glance.</p>
      </div>
    </div>

    <div v-if="error && !loading" class="load-error-state">
      <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
      <p class="load-error-title">Could not load the dashboard</p>
      <p class="load-error-sub">{{ error }}</p>
      <VButton variant="ghost" icon="rotate-ccw" @click="() => { cohorts.fetchList(); runs.fetchList() }">Try again</VButton>
    </div>

    <template v-else>
      <!-- Stat cards -->
      <div class="stats">
        <VStatCard
          label="Cohorts" :value="cohortCounts.total"
          chip-icon="layers" chip-bg="rgba(70,97,119,0.12)" chip-fg="#466177"
          foot-dot="#466177" :foot-text="`${cohortCounts.draft} draft · ${cohortCounts.refAccepted} in setup`"
          style="cursor: pointer" @click="router.push({ name: 'admin-cohorts' })"
        />
        <VStatCard
          label="Stood up" :value="cohortCounts.stoodUp + cohortCounts.locked"
          chip-icon="flag" chip-bg="rgba(46,125,50,0.12)" chip-fg="var(--success)"
          foot-dot="var(--success)" :foot-text="`${cohortCounts.locked} locked`"
        />
        <VStatCard
          label="Grading runs" :value="runs.list.length"
          chip-icon="refresh-cw" chip-bg="rgba(255,90,0,0.12)" chip-fg="var(--orange)"
          foot-dot="var(--orange)" :foot-text="`${attentionRuns.length} need attention`"
          style="cursor: pointer" @click="router.push({ name: 'admin-runs' })"
        />
        <VStatCard
          label="Open conflicts" :value="openConflicts"
          chip-icon="git-merge" chip-bg="var(--danger-bg)" chip-fg="var(--danger)"
          foot-dot="var(--danger)" foot-text="Awaiting resolution"
        />
      </div>

      <div class="dash-grid">
        <!-- Recent runs -->
        <div class="card">
          <div class="sec-head">
            <h2 class="sec-title">Recent grading runs</h2>
            <button class="link" @click="router.push({ name: 'admin-runs' })">View all</button>
          </div>
          <div class="uploads-scroll">
            <table class="tbl">
              <thead>
                <tr><th>File</th><th class="col-cohort">Cohort</th><th class="col-status">Status</th><th class="col-when">When</th></tr>
              </thead>
              <tbody v-if="loading">
                <tr v-for="i in 4" :key="i" class="skel-row">
                  <td><span class="skel mono" style="width: 70%" /></td>
                  <td class="col-cohort"><span class="skel" style="width: 60%" /></td>
                  <td class="col-status"><span class="skel" style="width: 64px; border-radius: 999px; display: inline-block" /></td>
                  <td class="col-when"><span class="skel mono" style="width: 80px" /></td>
                </tr>
              </tbody>
              <tbody v-else>
                <tr v-for="r in recentRuns" :key="r.id" style="cursor: pointer" @click="openRun(r)">
                  <td class="mono col-file" style="font-weight: 500">{{ r.workbookFilename ?? '—' }}</td>
                  <td class="col-cohort">{{ r.cohortName ?? '—' }}</td>
                  <td class="col-status"><VPill :tone="RUN_TONE[r.status]">{{ r.status }}</VPill></td>
                  <td class="col-when mono" style="color: var(--text-secondary)">{{ fmt(r.runAt ?? r.startedAt) }}</td>
                </tr>
                <tr v-if="recentRuns.length === 0"><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 24px">No runs yet.</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Attention required -->
        <div class="card card-pad">
          <div class="att-head">
            <VIcon name="alert-triangle" :size="22" color="#A83900" />
            <h2 class="sec-title">Attention required</h2>
          </div>
          <p class="att-intro">Runs with a high failure rate, partial commits, or unresolved conflicts.</p>

          <p v-if="!loading && attentionRuns.length === 0" class="att-empty">
            <VIcon name="check-circle-2" :size="15" style="color: var(--success)" /> Nothing needs attention.
          </p>

          <div v-for="r in attentionRuns" :key="r.id" class="att-item">
            <div class="att-row">
              <span class="att-who">{{ r.cohortName }}</span>
              <VPill :tone="r.highFailure ? 'danger' : 'warning'">
                {{ r.highFailure ? `${rejectPct(r)}% rejected` : r.status }}
              </VPill>
            </div>
            <div class="mono att-file">{{ r.workbookFilename ?? '—' }}</div>
            <div class="att-foot">
              <span>{{ r.counts?.committedNew ?? 0 }} new · {{ r.counts?.skippedInvalid ?? 0 }} invalid · {{ r.counts?.conflicts ?? 0 }} conflicts</span>
              <button class="link" @click="openRun(r)">Review →</button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@media (max-width: 1280px) {
  .dash-grid { grid-template-columns: 1fr; }
}
.uploads-scroll { overflow-x: auto; }
.col-status { width: 108px; }
.col-when { width: 140px; white-space: nowrap; }
.col-file { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.att-empty { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 14px; }
@media (max-width: 1100px) {
  .col-cohort { display: none; }
}
</style>
