<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import { useAuditStore } from '@/stores/audit'
import { useCohortsStore } from '@/stores/cohorts'
import { RUN_STATUS_TONE, type RunStatus } from '@/types/run.types'
import { EVENT_TYPE_TONE, EVENT_TYPE_ICON, TONE_CHIP_STYLE, type AuditEventType } from '@/types/audit.types'

const router = useRouter()
const route = useRoute()
const audit = useAuditStore()
const cohorts = useCohortsStore()

// Land back on the Events tab when returning from an event's detail page.
const tab = ref<'runs' | 'events'>(route.query.tab === 'events' ? 'events' : 'runs')
const expandedRun = ref<string | null>(null)

// Filters
const f = ref({ cohortId: '', status: '' as '' | RunStatus, eventType: '' as '' | AuditEventType, dateFrom: '', dateTo: ''})

function applyFilters() {
  audit.fetch({
    cohortId: f.value.cohortId || undefined,
    status: f.value.status || undefined,
    eventType: f.value.eventType || undefined,
    dateFrom: f.value.dateFrom || undefined,
    dateTo: f.value.dateTo || undefined,
  })
}

function resetFilters() {
  f.value = { cohortId: '', status: '', eventType: '', dateFrom: '', dateTo: ''}
  applyFilters()
}

function changeEventsPage(page: number) {
  audit.fetchEvents(page)
}

onMounted(() => {
  cohorts.fetchList()
  applyFilters()
})

const EVENT_TYPES = Object.keys(EVENT_TYPE_ICON) as AuditEventType[]
function eventLabel(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function eventIcon(t: string): string {
  return EVENT_TYPE_ICON[t as AuditEventType] ?? 'circle'
}
function fmt(iso?: string): string {
  return iso ? iso.replace('T', ' ').slice(0, 16) : '—'
}
function toggleRun(id: string) {
  expandedRun.value = expandedRun.value === id ? null : id
}

/** Colors the icon chip by the event's tone — the same signal a VPill would carry, without a redundant second badge. */
function eventChipStyle(t: string) {
  return TONE_CHIP_STYLE[EVENT_TYPE_TONE[t as AuditEventType] ?? 'info']
}

function openEvent(id: string) {
  router.push({ name: 'admin-audit-event', params: { id } })
}

const events = computed(() => audit.eventsPage?.content ?? [])

/** Neither the real grading-runs nor audit-events endpoint denormalizes the cohort name — look it up. */
function cohortLabel(r: { cohortId: string | null; cohortName?: string }): string {
  return r.cohortName ?? cohorts.list.find((c) => c.id === r.cohortId)?.name ?? r.cohortId ?? '—'
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1 class="page-title">Audit</h1>
      <p class="page-sub">Every ingestion run and cohort lifecycle event — append-only, cross-run history.</p>
    </div>
  </div>

  <!-- Filter bar -->
  <div class="filter-bar">
    <label class="fld">
      <span>Cohort</span>
      <select v-model="f.cohortId" @change="applyFilters">
        <option value="">All</option>
        <option v-for="c in cohorts.list" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>
    <label class="fld">
      <span>Status</span>
      <select v-model="f.status" @change="applyFilters">
        <option value="">All</option>
        <option value="completed">Completed</option>
        <option value="partial">Partial</option>
        <option value="failed">Failed</option>
        <option value="skipped">Skipped</option>
      </select>
    </label>
    <label class="fld">
      <span>Event type</span>
      <select v-model="f.eventType" @change="applyFilters">
        <option value="">All</option>
        <option v-for="t in EVENT_TYPES" :key="t" :value="t">{{ eventLabel(t) }}</option>
      </select>
    </label>
    <label class="fld">
      <span>From</span>
      <input v-model="f.dateFrom" type="date" @change="applyFilters" />
    </label>
    <label class="fld">
      <span>To</span>
      <input v-model="f.dateTo" type="date" @change="applyFilters" />
    </label>

    <VButton variant="ghost" size="sm" icon="x" @click="resetFilters">Clear</VButton>
  </div>

  <!-- Tabs -->
  <div class="tabs" role="tablist">
    <button :class="['tab', { on: tab === 'runs' }]" role="tab" :aria-selected="tab === 'runs'" @click="tab = 'runs'">
      Ingestion runs <span class="count-badge mono">{{ audit.runs.length }}</span>
    </button>
    <button :class="['tab', { on: tab === 'events' }]" role="tab" :aria-selected="tab === 'events'" @click="tab = 'events'">
      Lifecycle events <span class="count-badge mono">{{ audit.eventsPage?.totalElements ?? 0 }}</span>
    </button>
  </div>

  <!-- Runs tab -->
  <div v-if="tab === 'runs' && audit.error && !audit.loading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load runs</p>
    <p class="load-error-sub">{{ audit.error }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="applyFilters">Try again</VButton>
  </div>

  <div v-else-if="tab === 'runs'" class="tbl-wrap">
    <table class="tbl">
      <thead>
        <tr><th>Cohort</th><th>Trigger</th><th style="text-align: center">Status</th><th>When</th><th aria-hidden="true"></th></tr>
      </thead>

      <tbody v-if="audit.loading">
        <tr v-for="i in 4" :key="i" class="skel-row">
          <td><span class="skel" style="width: 60%" /></td>
          <td class="muted"><span class="skel" style="width: 70%" /></td>
          <td style="text-align: center"><span class="skel" style="width: 64px; border-radius: 999px; margin: 0 auto" /></td>
          <td><span class="skel mono" style="width: 90px" /></td>
          <td></td>
        </tr>
      </tbody>

      <tbody v-else>
        <template v-for="r in audit.runs" :key="r.id">
          <tr class="row-click" @click="toggleRun(r.id)">
            <td>{{ cohortLabel(r) }}</td>
            <td class="muted">{{ !r.triggerType ? '—' : r.triggerType === 'SCHEDULED' ? 'Scheduled · System' : `Manual · ${r.triggeredByEmail ?? r.triggeredBy ?? 'Admin'}` }}</td>
            <td style="text-align: center"><VPill :tone="RUN_STATUS_TONE[r.status]">{{ r.status }}</VPill></td>
            <td class="mono muted">{{ fmt(r.runAt ?? r.startedAt) }}</td>
            <td style="text-align: right; width: 44px"><VIcon :name="expandedRun === r.id ? 'chevron-down' : 'chevron-right'" :size="18" class="muted" /></td>
          </tr>
          <tr v-if="expandedRun === r.id" class="detail-row">
            <td colspan="5">
              <div class="run-detail">
                <div class="rd-counts mono">
                  {{ r.counts?.rowsRead ?? 0 }} read · {{ r.counts?.committedNew ?? 0 }} new · {{ r.counts?.updated ?? 0 }} updated ·
                  {{ r.counts?.skippedInvalid ?? 0 }} invalid · {{ r.counts?.skippedUnchanged ?? 0 }} unchanged · {{ r.counts?.conflicts ?? 0 }} conflicts
                </div>
                <div v-if="r.sharepointVersionId" class="rd-meta mono muted">version {{ r.sharepointVersionId }} · hash {{ r.quickXorHash }}</div>
                <div v-if="r.errorReport?.length" class="rd-errors">
                  <p class="rd-errors-title">Rejected rows</p>
                  <ul class="err-list">
                    <li v-for="(e, i) in r.errorReport ?? []" :key="i" class="mono err-item">
                      {{ [e.sheet, e.row != null ? `row ${e.row}` : '', e.rule].filter(Boolean).join(' · ') }} — {{ e.message }}
                    </li>
                  </ul>
                </div>
                <VButton size="sm" variant="ghost" icon-right="arrow-right" @click.stop="router.push({ name: 'admin-run-review', params: { id: r.id }, query: { cohortId: r.cohortId } })">Open run review</VButton>
              </div>
            </td>
          </tr>
        </template>
        <tr v-if="audit.runs.length === 0"><td colspan="5"><div class="empty-inline"><VIcon name="scroll-text" :size="24" class="muted" /><p class="empty-sub">No runs match these filters.</p></div></td></tr>
      </tbody>
    </table>
  </div>

  <!-- Events tab -->
  <div v-else-if="audit.eventsError && !audit.eventsLoading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load events</p>
    <p class="load-error-sub">{{ audit.eventsError }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="changeEventsPage(0)">Try again</VButton>
  </div>

  <template v-else>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr><th>Event</th><th>Cohort</th><th>Actor</th><th>When</th><th aria-hidden="true"></th></tr>
        </thead>

        <tbody v-if="audit.eventsLoading">
          <tr v-for="i in 4" :key="i" class="skel-row">
            <td><span class="skel" style="width: 70%" /></td>
            <td><span class="skel" style="width: 60%" /></td>
            <td class="muted"><span class="skel" style="width: 50%" /></td>
            <td><span class="skel mono" style="width: 90px" /></td>
            <td></td>
          </tr>
        </tbody>

        <tbody v-else>
          <tr v-for="e in events" :key="e.id" class="row-click" @click="openEvent(e.id)">
            <td>
              <span class="event-cell">
                <span class="event-ic" :style="eventChipStyle(e.eventType)"><VIcon :name="eventIcon(e.eventType)" :size="14" /></span>
                {{ eventLabel(e.eventType) }}
              </span>
            </td>
            <td>{{ cohortLabel(e) }}</td>
            <td class="muted">{{ e.actorEmail ?? 'SYSTEM' }}</td>
            <td class="mono muted">{{ fmt(e.occurredAt) }}</td>
            <td style="text-align: right; width: 44px"><VIcon name="chevron-right" :size="18" class="muted" /></td>
          </tr>
          <tr v-if="events.length === 0"><td colspan="5"><div class="empty-inline"><VIcon name="scroll-text" :size="24" class="muted" /><p class="empty-sub">No events match these filters.</p></div></td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="!audit.eventsLoading && audit.eventsPage && events.length > 0" class="pager">
      <VButton size="sm" variant="ghost" :disabled="audit.eventsPage.number === 0" @click="changeEventsPage(audit.eventsPage.number - 1)">Prev</VButton>
      <span class="mono muted">Page {{ audit.eventsPage.number + 1 }} of {{ Math.max(audit.eventsPage.totalPages, 1) }}</span>
      <VButton size="sm" variant="ghost" :disabled="audit.eventsPage.last" @click="changeEventsPage(audit.eventsPage.number + 1)">Next</VButton>
    </div>
  </template>
</template>

<style scoped>
.page-sub { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }
.muted { color: var(--text-secondary); }
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 14px; }

.filter-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-bottom: 20px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow-card); }
.fld { display: flex; flex-direction: column; gap: 4px; }
.fld > span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
.fld select, .fld input { height: 38px; border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); padding: 0 10px; font-family: inherit; font-size: 14px; color: var(--text); }
.fld input[type="date"] { font-family: var(--font-mono); }
.fld select:focus-visible, .fld input:focus-visible { outline: none; border-color: var(--orange); box-shadow: var(--ring-focus); }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
.tab { background: none; border: none; padding: 10px 16px; font-family: inherit; font-size: 14px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; display: flex; align-items: center; gap: 8px; }
.tab.on { color: var(--navy); border-bottom-color: var(--orange); }
.count-badge { font-size: 11px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; color: var(--text-secondary); }

.row-click { cursor: pointer; }
.detail-row td { background: var(--bg); }
.run-detail { display: flex; flex-direction: column; gap: 10px; padding: 6px 4px; }
.rd-counts { font-size: 13px; }
.rd-meta { font-size: 12px; }
.rd-errors-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
.err-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.err-item { font-size: 12.5px; color: var(--danger); background: var(--danger-bg); padding: 6px 10px; border-radius: 3px; }

.event-cell { display: inline-flex; align-items: center; gap: 10px; font-weight: 500; }
.event-ic { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: var(--r-sm); flex-shrink: 0; }

.empty-inline { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 16px; text-align: center; }
.empty-sub { color: var(--text-secondary); font-size: 14px; }
</style>
