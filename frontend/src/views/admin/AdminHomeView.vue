<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VIcon from '@/components/base/VIcon.vue'
import VButton from '@/components/base/VButton.vue'
import VPill from '@/components/base/VPill.vue'
import { RUN_STATUS_TONE, type IngestionRun, type RunStatus } from '@/types/run.types'
import { useCohortsStore } from '@/stores/cohorts'
import { useRunsStore } from '@/stores/runs'
import { useConflictsStore } from '@/stores/conflicts'
import { usePageTitle } from '@/composables/usePageTitle'
import { fmtDate, fmtTime, whenOf } from '@/utils/datetime'
import '@/assets/styles/dashboard.css'

usePageTitle('Dashboard')

const router = useRouter()
const cohorts = useCohortsStore()
const runs = useRunsStore()
const conflicts = useConflictsStore()

const loading = computed(() => cohorts.loading || runs.loading || runs.statsLoading || conflicts.loading)
const error = computed(() => cohorts.error || runs.error || conflicts.error)

/**
 * Cohort/run lists load in parallel; the cohort-scoped conflicts totals and run stats both need
 * cohort ids first, so they fetch once that list lands — narrowed to STOOD_UP cohorts, since
 * draft/reference-accepted cohorts have no ingestion runs yet, so querying them would just be wasted requests.
 */
async function loadDashboard() {
  await Promise.all([cohorts.fetchList(), runs.fetchList()])
  const eligibleIds = cohorts.list.filter((c) => c.lifecycleState === 'STOOD_UP').map((c) => c.id)
  await Promise.all([conflicts.fetchTotalOpen(eligibleIds), runs.fetchStats(eligibleIds)])
}

onMounted(loadDashboard)

const STATUS_LABEL: Record<RunStatus, string> = {
  completed: 'Completed', partial: 'Partial', failed: 'Failed', skipped: 'Skipped', processing: 'Processing',
}

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
/**
 * `r.highFailure`/`r.counts` are never populated by `runs.list`'s own endpoint (§ FND-46) — the
 * enriched signal comes from `runs.stats` (keyed by this same run's id) instead. `r.status ===
 * 'failed'` is kept as a direct fallback since that much the job endpoint does report correctly.
 */
const attentionRuns = computed(() =>
  runs.list.filter((r) => {
    const s = runs.stats.get(r.id)
    return r.status === 'failed' || !!s?.highFailure || !!s?.failed || (s?.counts.conflicts ?? 0) > 0 || (s?.counts.skippedInvalid ?? 0) > 0
  }),
)
const openConflicts = computed(() => conflicts.totalOpen)

// ── KPI cards ────────────────────────────────────────────────────────────────
type Tone = 'blue' | 'green' | 'orange' | 'red'
interface Kpi {
  key: string
  label: string
  value: number
  icon: string
  tone: Tone
  sub: string
  dot: boolean
  to?: string
}
const kpis = computed<Kpi[]>(() => {
  const c = cohortCounts.value
  return [
    {
      key: 'cohorts', label: 'Active Cohorts', value: c.total, icon: 'layers', tone: 'blue',
      sub: `${c.draft} draft · ${c.refAccepted} in setup`, dot: false, to: 'admin-cohorts',
    },
    {
      key: 'ready', label: 'Ready for Grading', value: c.stoodUp + c.locked, icon: 'flag', tone: 'green',
      sub: c.locked > 0 ? `${c.locked} locked` : 'All unlocked', dot: false, to: 'admin-cohorts',
    },
    {
      key: 'runs', label: 'Grading Runs', value: runs.list.length, icon: 'refresh-cw', tone: 'orange',
      sub: `${attentionRuns.value.length} need${attentionRuns.value.length === 1 ? 's' : ''} attention`, dot: attentionRuns.value.length > 0, to: 'admin-runs',
    },
    {
      key: 'conflicts', label: 'Open Conflicts', value: openConflicts.value, icon: 'git-merge', tone: 'red',
      sub: openConflicts.value > 0 ? 'Awaiting resolution' : 'None open', dot: openConflicts.value > 0, to: 'admin-audit',
    },
  ]
})

// ── Attention required ───────────────────────────────────────────────────────
interface Attn {
  id: string
  priority: 'high' | 'medium' | 'low'
  title: string
  sub: string
  action: string
  run: IngestionRun
}
const attentionItems = computed<Attn[]>(() =>
  attentionRuns.value.map((r) => {
    const s = runs.stats.get(r.id)
    const conflicts = s?.counts.conflicts ?? 0
    const skippedInvalid = s?.counts.skippedInvalid ?? 0
    if (s?.highFailure) {
      return { id: r.id, priority: 'high', title: cohortLabel(r), sub: `${rejectPct(r)}% of submissions rejected`, action: 'Review run', run: r }
    }
    if (conflicts > 0) {
      return { id: r.id, priority: 'high', title: cohortLabel(r), sub: `${conflicts} unresolved conflict${conflicts === 1 ? '' : 's'}`, action: 'Resolve conflicts', run: r }
    }
    if (skippedInvalid > 0) {
      return { id: r.id, priority: 'medium', title: cohortLabel(r), sub: `${skippedInvalid} row${skippedInvalid === 1 ? '' : 's'} rejected`, action: 'Review run', run: r }
    }
    return { id: r.id, priority: 'medium', title: cohortLabel(r), sub: r.status === 'failed' ? 'Run failed' : 'Partial commit', action: 'Review run', run: r }
  }),
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function rejectPct(r: IngestionRun): number {
  const s = runs.stats.get(r.id)
  const rowsRead = s?.counts.rowsRead ?? 0
  return rowsRead > 0 ? Math.round(((s?.counts.skippedInvalid ?? 0) / rowsRead) * 100) : 0
}
function runWhen(r: IngestionRun): string | undefined {
  return whenOf(r.runAt, r.completedAt, r.startedAt)
}
function triggerLabel(r: IngestionRun): string {
  if (!r.triggerType) return '—'
  return r.triggerType === 'SCHEDULED' ? 'Scheduled' : 'Manual'
}
function triggerWho(r: IngestionRun): string {
  return r.triggerType === 'SCHEDULED' ? 'System' : (r.triggeredByEmail ?? r.triggeredBy ?? 'Admin')
}
const SEASONS = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter']
function cohortTerm(r: IngestionRun): string {
  const c = cohorts.list.find((x) => x.id === r.cohortId)
  if (!c?.startDate) return ''
  const d = new Date(c.startDate)
  if (Number.isNaN(d.getTime())) return ''
  return `${SEASONS[d.getMonth()]} ${d.getFullYear()}`
}
function cohortLabel(r: IngestionRun): string {
  return r.cohortName ?? cohorts.list.find((c) => c.id === r.cohortId)?.name ?? r.cohortId
}
function openRun(r: IngestionRun) {
  router.push({ name: 'admin-run-review', params: { id: r.syncJobId ?? r.id }, query: { cohortId: r.cohortId } })
}
function go(to?: string) {
  if (to) router.push({ name: to })
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

    <!-- Run-stats enrichment failed (best-effort KPI/needs-attention data) — don't block the page,
         but don't let those panels read as all-zero either. -->
    <p v-if="runs.statsError && !loading" class="inline-error" style="margin: -8px 0 16px"><VIcon name="alert-circle" :size="14" /> Run statistics unavailable: {{ runs.statsError }}</p>

    <div v-if="error && !loading" class="load-error-state">
      <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
      <p class="load-error-title">Could not load the dashboard</p>
      <p class="load-error-sub">{{ error }}</p>
      <VButton variant="ghost" icon="rotate-ccw" @click="loadDashboard">Try again</VButton>
    </div>

    <template v-else>
      <!-- KPI cards — one horizontal row -->
      <div class="kpi-row">
        <template v-if="loading">
          <div v-for="i in 4" :key="i" class="skel-stat" style="height: 120px" />
        </template>
        <template v-else>
          <button v-for="k in kpis" :key="k.key" :class="['kpi', `kpi--${k.tone}`, { 'kpi--link': k.to }]" @click="go(k.to)">
            <div class="kpi-top">
              <span class="kpi-label">{{ k.label }}</span>
              <span class="kpi-chip"><VIcon :name="k.icon" :size="18" /></span>
            </div>
            <div class="kpi-num">{{ k.value }}</div>
            <div class="kpi-sub">
              <span v-if="k.dot" class="kpi-dot" />
              {{ k.sub }}
            </div>
          </button>
        </template>
      </div>

      <div class="dash-grid">
        <!-- Recent grading runs -->
        <div class="card panel">
          <div class="sec-head">
            <h2 class="sec-title">Recent grading runs</h2>
            <button class="link" @click="router.push({ name: 'admin-runs' })">View all</button>
          </div>
          <div class="recent-scroll">
            <table class="tbl recent-tbl">
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody v-if="loading">
                <tr v-for="i in 5" :key="i" class="skel-row">
                  <td><span class="skel" style="width: 70%" /></td>
                  <td><span class="skel" style="width: 60%" /></td>
                  <td><span class="skel" style="width: 74px; border-radius: 999px; display: inline-block" /></td>
                  <td><span class="skel" style="width: 80px" /></td>
                </tr>
              </tbody>
              <tbody v-else>
                <tr v-for="r in recentRuns" :key="r.id" class="row-click" @click="openRun(r)">
                  <td class="cohort-cell">
                    <span class="cohort-name">{{ cohortLabel(r) }}</span>
                    <span v-if="cohortTerm(r)" class="cohort-term">{{ cohortTerm(r) }}</span>
                  </td>
                  <td>
                    <span class="trigger-cell">
                      <VIcon v-if="r.triggerType" :name="r.triggerType === 'SCHEDULED' ? 'calendar-clock' : 'user'" :size="14" class="trigger-ic" />
                      <span>{{ triggerLabel(r) }} <span class="muted">· {{ triggerWho(r) }}</span></span>
                    </span>
                  </td>
                  <td><VPill :tone="RUN_STATUS_TONE[r.status]">{{ STATUS_LABEL[r.status] }}</VPill></td>
                  <td class="when-cell">
                    <span class="when-date">{{ fmtDate(runWhen(r)) }}</span>
                    <span v-if="runWhen(r)" class="when-time">{{ fmtTime(runWhen(r)) }}</span>
                  </td>
                </tr>
                <tr v-if="recentRuns.length === 0">
                  <td colspan="4">
                    <div class="tbl-empty"><VIcon name="inbox" :size="20" class="muted" /><span>No grading runs yet.</span></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Attention required -->
        <div class="card panel">
          <div class="sec-head">
            <div class="att-head">
              <VIcon name="alert-triangle" :size="18" color="#A83900" />
              <h2 class="sec-title">Attention required</h2>
            </div>
            <button class="link" @click="router.push({ name: 'admin-runs' })">View all</button>
          </div>

          <div class="attn-list">
            <p v-if="!loading && attentionItems.length === 0" class="attn-empty">
              <VIcon name="check-circle-2" :size="16" style="color: var(--success)" /> Nothing needs attention right now.
            </p>
            <div v-for="a in attentionItems" :key="a.id" :class="['attn', `attn--${a.priority}`]">
              <span :class="['attn-badge', `attn-badge--${a.priority}`]">{{ a.priority.toUpperCase() }}</span>
              <div class="attn-body">
                <span class="attn-title">{{ a.title }}</span>
                <span class="attn-sub">{{ a.sub }}</span>
              </div>
              <button :class="['attn-action', `attn-action--${a.priority}`]" @click="openRun(a.run)">{{ a.action }}</button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ── KPI row — 4 cards on one horizontal line ── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}
.kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--dash-border, var(--border));
  border-radius: var(--dash-radius, 16px);
  box-shadow: var(--dash-shadow, var(--shadow-card));
  padding: 20px 22px;
  font-family: inherit;
  cursor: default;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}
.kpi--link { cursor: pointer; }
.kpi--link:hover { transform: translateY(-3px); box-shadow: var(--dash-shadow-hover, var(--shadow-pop)); }
.kpi-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.kpi-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.kpi-chip { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; }
.kpi-num { font-family: var(--font-display); font-weight: 700; font-size: 34px; line-height: 1; letter-spacing: -0.5px; color: var(--navy); margin-top: 6px; }
.kpi-sub { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: var(--text-secondary); margin-top: 8px; }
.kpi-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

.kpi--blue .kpi-chip { background: var(--chip-blue-bg); color: var(--chip-blue-fg); }
.kpi--green .kpi-chip { background: var(--success-bg); color: var(--success); }
.kpi--orange .kpi-chip { background: var(--chip-orange-bg); color: var(--chip-orange-fg); }
.kpi--red .kpi-chip { background: var(--danger-bg); color: var(--danger); }
.kpi--orange .kpi-dot { color: var(--orange); }
.kpi--red .kpi-dot { color: var(--danger); }

/* ── Panels ── */
.panel { display: flex; flex-direction: column; }
.att-head { display: inline-flex; align-items: center; gap: 9px; }

/* ── Recent grading runs (design-system table, light header) ── */
.recent-scroll { overflow-x: auto; }
.recent-tbl { width: 100%; }
.recent-tbl thead th {
  background: var(--table-head-bg);
  color: var(--navy);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  padding: 12px 20px;
  white-space: nowrap;
}
.recent-tbl tbody td { padding: 12px 20px; border-top-color: var(--border-soft); }
.recent-tbl tbody tr:hover { background: var(--bg); }
.row-click { cursor: pointer; }
.muted { color: var(--text-secondary); }

.cohort-cell { min-width: 0; }
.cohort-name { font-weight: 600; font-size: 14px; }
.cohort-term { display: block; font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.trigger-cell { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
.trigger-ic { color: var(--text-secondary); flex-shrink: 0; }

.when-cell { display: flex; flex-direction: column; gap: 2px; }
.when-date { font-size: 13px; color: var(--text); }
.when-time { font-size: 13px; color: var(--text-secondary); }

.tbl-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 16px; color: var(--text-secondary); font-size: 14px; text-align: center; }

/* ── Attention required ── */
.attn-list { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
.attn-empty { display: flex; align-items: center; gap: 7px; color: var(--text-secondary); font-size: 14px; padding: 8px 0; }
.attn { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--border); }
.attn--high { background: var(--danger-bg); border-color: #F3D2D2; }
.attn--medium { background: var(--warning-bg); border-color: #F1E2BE; }
.attn--low { background: var(--info-bg); border-color: #BFD9EF; }
.attn-badge { flex-shrink: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; padding: 4px 9px; border-radius: var(--r-sm); }
.attn-badge--high { background: var(--danger); color: #fff; }
.attn-badge--medium { background: var(--warning); color: #fff; }
.attn-badge--low { background: var(--info); color: #fff; }
.attn-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.attn-title { font-size: 14px; font-weight: 600; color: var(--text); }
.attn-sub { font-size: 13px; color: var(--text-secondary); }
.attn-action { flex-shrink: 0; height: 34px; padding: 0 14px; border-radius: var(--r-md); background: #fff; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.attn-action--high { border: 1px solid var(--danger); color: var(--danger); }
.attn-action--medium { border: 1px solid var(--warning); color: var(--warning); }
.attn-action--low { border: 1px solid var(--info); color: var(--info); }
.attn-action:hover { filter: brightness(0.97); }

@media (max-width: 1180px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 1280px) { .dash-grid { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .kpi-row { grid-template-columns: 1fr; } }
</style>
