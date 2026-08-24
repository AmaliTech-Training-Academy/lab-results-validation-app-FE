<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import VSortIcon from '@/components/base/VSortIcon.vue'
import { useAuditStore } from '@/stores/audit'
import { useCohortsStore } from '@/stores/cohorts'
import { getCohortReference } from '@/services/cohorts.service'
import { RUN_STATUS_TONE, type IngestionRun, type RunStatus } from '@/types/run.types'
import { EVENT_TYPE_TONE, EVENT_TYPE_ICON, TONE_CHIP_STYLE, type AuditEventType, type AuditEvent } from '@/types/audit.types'
import type { InstructorContact } from '@/types/domain.types'

const router = useRouter()
const route = useRoute()
const audit = useAuditStore()
const cohorts = useCohortsStore()

// Land back on the Events tab when returning from an event's detail page.
const tab = ref<'runs' | 'events'>(route.query.tab === 'events' ? 'events' : 'runs')
const expandedRun = ref<string | null>(null)

const STATUS_LABEL: Record<RunStatus, string> = {
  completed: 'Completed', partial: 'Partial', failed: 'Failed', skipped: 'Skipped', processing: 'Processing',
}
const STATUS_ORDER: Record<RunStatus, number> = { failed: 0, partial: 1, processing: 2, completed: 3, skipped: 4 }

// Filters
const f = ref({ cohortId: '', status: '' as '' | RunStatus, eventType: '' as '' | AuditEventType, instructorContactId: '', dateFrom: '', dateTo: '' })

function applyFilters() {
  audit.fetch({
    cohortId: f.value.cohortId || undefined,
    status: f.value.status || undefined,
    eventType: f.value.eventType || undefined,
    instructorContactId: f.value.instructorContactId || undefined,
    dateFrom: f.value.dateFrom || undefined,
    dateTo: f.value.dateTo || undefined,
  })
}

function resetFilters() {
  f.value = { cohortId: '', status: '', eventType: '', instructorContactId: '', dateFrom: '', dateTo: '' }
  applyFilters()
}

/**
 * No cross-cohort instructor-listing endpoint exists (`GET /instructors/{id}` is a single-id lookup only) —
 * the "Runs only" instructorContactId filter (D5 AC1) needs *a* list to pick from, so fan out the lightweight
 * per-cohort reference endpoint over every stood-up cohort and merge, deduping by id (an instructor can be
 * attached to more than one cohort's reference bundle). A failed lookup for one cohort shouldn't blank the
 * whole list — skip it and keep whatever the others returned.
 */
const instructors = ref<InstructorContact[]>([])
async function loadInstructors() {
  const bundles = await Promise.all(
    cohorts.list.filter((c) => c.lifecycleState === 'STOOD_UP').map((c) => getCohortReference(c.id).catch(() => null)),
  )
  const byId = new Map<string, InstructorContact>()
  for (const b of bundles) for (const ins of b?.instructors ?? []) byId.set(ins.id, ins)
  instructors.value = [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName))
}

function changeEventsPage(page: number) {
  if (page < 0 || (audit.eventsPage && page >= audit.eventsPage.totalPages)) return
  audit.fetchEvents(page)
}

function changeRunsPage(page: number) {
  if (page < 0 || (audit.runsPage && page >= audit.runsPage.totalPages)) return
  audit.fetchRuns(page)
}

onMounted(async () => {
  await cohorts.fetchList()
  loadInstructors()
  applyFilters()
  window.addEventListener('click', closeKebab)
})
onUnmounted(() => window.removeEventListener('click', closeKebab))

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

/** `r.id` is the ingestion_runs row itself, not the sync job — the run-review page is keyed by the parent job (`syncJobId`), scoped to the same cohort. */
function openRunReview(r: IngestionRun) {
  router.push({ name: 'admin-run-review', params: { id: r.syncJobId }, query: { cohortId: r.cohortId } })
}

const runs = computed(() => audit.runsPage?.content ?? [])
const events = computed(() => audit.eventsPage?.content ?? [])

// Built once instead of scanning cohorts.list per row inside cohortLabel — this page sorts on
// every column click, and each sort re-runs cohortLabel for the whole (already-paginated) page.
const cohortById = computed(() => new Map(cohorts.list.map((c) => [c.id, c])))

/** Neither the real grading-runs nor audit-events endpoint denormalizes the cohort name — look it up. */
function cohortLabel(r: { cohortId: string | null; cohortName?: string }): string {
  return r.cohortName ?? cohortById.value.get(r.cohortId ?? '')?.name ?? r.cohortId ?? '—'
}

// ── Client-side sort (over the current server page) ─────────────────────────
type RunSortKey = 'cohort' | 'workbook' | 'trigger' | 'status' | 'when'
const runSortKey = ref<RunSortKey>('when')
const runSortDir = ref<'asc' | 'desc'>('desc')
function toggleRunSort(k: RunSortKey) {
  if (runSortKey.value === k) runSortDir.value = runSortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    runSortKey.value = k
    runSortDir.value = k === 'when' ? 'desc' : 'asc'
  }
}
function runSortVal(r: IngestionRun, k: RunSortKey): string | number {
  switch (k) {
    case 'cohort': return cohortLabel(r).toLowerCase()
    case 'workbook': return (r.workbookFilename ?? '').toLowerCase()
    case 'trigger': return r.triggerType ?? ''
    case 'status': return STATUS_ORDER[r.status]
    case 'when': return r.runAt ?? r.startedAt ?? ''
  }
}
const sortedRuns = computed(() => {
  const dir = runSortDir.value === 'asc' ? 1 : -1
  return [...runs.value].sort((a, b) => {
    const av = runSortVal(a, runSortKey.value)
    const bv = runSortVal(b, runSortKey.value)
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return cmp * dir
  })
})

type EventSortKey = 'event' | 'cohort' | 'actor' | 'when'
const eventSortKey = ref<EventSortKey>('when')
const eventSortDir = ref<'asc' | 'desc'>('desc')
function toggleEventSort(k: EventSortKey) {
  if (eventSortKey.value === k) eventSortDir.value = eventSortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    eventSortKey.value = k
    eventSortDir.value = k === 'when' ? 'desc' : 'asc'
  }
}
function eventSortVal(e: AuditEvent, k: EventSortKey): string {
  switch (k) {
    case 'event': return eventLabel(e.eventType).toLowerCase()
    case 'cohort': return cohortLabel(e).toLowerCase()
    case 'actor': return (e.actorEmail ?? 'system').toLowerCase()
    case 'when': return e.occurredAt
  }
}
const sortedEvents = computed(() => {
  const dir = eventSortDir.value === 'asc' ? 1 : -1
  return [...events.value].sort((a, b) => eventSortVal(a, eventSortKey.value).localeCompare(eventSortVal(b, eventSortKey.value)) * dir)
})

// ── Row actions (kebab) ──────────────────────────────────────────────────────
const activeKebabId = ref<string | null>(null)
const kebabPos = ref<{ top: number; left: number } | null>(null)
const activeKebabRun = computed(() => runs.value.find((r) => r.id === activeKebabId.value) ?? null)
const activeKebabEvent = computed(() => events.value.find((e) => e.id === activeKebabId.value) ?? null)
function toggleKebab(event: MouseEvent, id: string) {
  event.stopPropagation()
  if (activeKebabId.value === id) {
    closeKebab()
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  kebabPos.value = { top: rect.bottom + 4, left: rect.right - 180 }
  activeKebabId.value = id
}
function closeKebab() {
  activeKebabId.value = null
  kebabPos.value = null
}

// ── Server-page pager helpers ────────────────────────────────────────────────
/** Windowed 1-based page numbers for a server-paginated table (0-based `current`). */
function pagesFor(totalPages: number, current: number): (number | '…')[] {
  const tp = Math.max(totalPages, 1)
  const cur = current + 1
  if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
  const items: (number | '…')[] = []
  if (cur <= 4) {
    for (let i = 1; i <= 5; i++) items.push(i)
    items.push('…', tp)
  } else if (cur >= tp - 3) {
    items.push(1, '…')
    for (let i = tp - 4; i <= tp; i++) items.push(i)
  } else {
    items.push(1, '…', cur - 1, cur, cur + 1, '…', tp)
  }
  return items
}
function showFrom(number: number, size: number, total: number): number {
  return total === 0 ? 0 : number * size + 1
}
function showTo(number: number, size: number, total: number): number {
  return Math.min((number + 1) * size, total)
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
      <span>Instructor</span>
      <select v-model="f.instructorContactId" @change="applyFilters">
        <option value="">All</option>
        <option v-for="ins in instructors" :key="ins.id" :value="ins.id">{{ ins.fullName }}</option>
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

    <button type="button" class="af-reset" @click="resetFilters">
      <VIcon name="rotate-ccw" :size="15" />
      Reset filters
    </button>
  </div>

  <!-- Tabs -->
  <div class="tabs" role="tablist">
    <button :class="['tab', { on: tab === 'runs' }]" role="tab" :aria-selected="tab === 'runs'" @click="tab = 'runs'">
      Ingestion runs <span class="count-badge mono">{{ audit.runsPage?.totalElements ?? 0 }}</span>
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
        <tr>
          <th><button class="th-sort" @click="toggleRunSort('cohort')">Cohort <VSortIcon :active="runSortKey === 'cohort'" :dir="runSortDir" /></button></th>
          <th><button class="th-sort" @click="toggleRunSort('workbook')">Workbook <VSortIcon :active="runSortKey === 'workbook'" :dir="runSortDir" /></button></th>
          <th><button class="th-sort" @click="toggleRunSort('trigger')">Trigger <VSortIcon :active="runSortKey === 'trigger'" :dir="runSortDir" /></button></th>
          <th><button class="th-sort" @click="toggleRunSort('status')">Status <VSortIcon :active="runSortKey === 'status'" :dir="runSortDir" /></button></th>
          <th><button class="th-sort" @click="toggleRunSort('when')">When <VSortIcon :active="runSortKey === 'when'" :dir="runSortDir" /></button></th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>

      <tbody v-if="audit.loading">
        <tr v-for="i in 4" :key="i" class="skel-row">
          <td><span class="skel" style="width: 60%" /></td>
          <td><span class="skel" style="width: 80%" /></td>
          <td><span class="skel" style="width: 70%" /></td>
          <td><span class="skel" style="width: 74px; border-radius: 999px" /></td>
          <td><span class="skel" style="width: 90px" /></td>
          <td class="col-actions"><span class="skel" style="width: 18px; display: inline-block" /></td>
        </tr>
      </tbody>

      <tbody v-else>
        <template v-for="r in sortedRuns" :key="r.id">
          <tr class="row-click" @click="toggleRun(r.id)">
            <td class="cohort-name">{{ cohortLabel(r) }}</td>
            <td class="muted">{{ r.workbookFilename ?? '—' }}</td>
            <td>
              <span class="trigger-cell">
                <VIcon v-if="r.triggerType" :name="r.triggerType === 'SCHEDULED' ? 'calendar-clock' : 'user'" :size="15" class="trigger-ic" />
                <span v-if="!r.triggerType" class="muted">—</span>
                <span v-else>
                  {{ r.triggerType === 'SCHEDULED' ? 'Scheduled' : 'Manual' }}
                  <span class="muted">· {{ r.triggerType === 'SCHEDULED' ? 'System' : (r.triggeredByEmail ?? r.triggeredBy ?? 'Admin') }}</span>
                </span>
              </span>
            </td>
            <td><VPill :tone="RUN_STATUS_TONE[r.status]">{{ STATUS_LABEL[r.status] }}</VPill></td>
            <td class="when-cell">
              <span class="when-date">{{ (r.runAt ?? r.startedAt ?? '').slice(0, 10) || '—' }}</span>
              <span v-if="(r.runAt ?? r.startedAt)" class="when-time">{{ (r.runAt ?? r.startedAt ?? '').slice(11, 16) }}</span>
            </td>
            <td class="col-actions">
              <button class="kebab" aria-label="Row actions" @click="toggleKebab($event, r.id)">
                <VIcon name="more-vertical" :size="18" />
              </button>
            </td>
          </tr>
          <tr v-if="expandedRun === r.id" class="detail-row">
            <td colspan="6">
              <div class="run-detail">
                <div class="rd-counts mono">
                  {{ r.counts?.rowsRead ?? 0 }} read · {{ r.counts?.committedNew ?? 0 }} new · {{ r.counts?.updated ?? 0 }} updated ·
                  {{ r.counts?.skippedInvalid ?? 0 }} invalid · {{ r.counts?.skippedUnchanged ?? 0 }} unchanged · {{ r.counts?.conflicts ?? 0 }} conflicts
                </div>
                <div v-if="r.highFailure" class="rd-hi-fail mono">
                  <VIcon name="alert-triangle" :size="13" /> High failure — {{ r.failureRatePercent?.toFixed(1) }}% rejected
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
                <div v-if="r.syncJobId" class="rd-footer">
                  <VButton variant="primary" size="sm" icon-right="arrow-right" @click.stop="openRunReview(r)">Open run review</VButton>
                </div>
              </div>
            </td>
          </tr>
        </template>
        <tr v-if="sortedRuns.length === 0"><td colspan="6"><div class="empty-inline"><VIcon name="scroll-text" :size="24" class="muted" /><p class="empty-sub">No runs match these filters.</p></div></td></tr>
      </tbody>
    </table>

    <div v-if="!audit.loading && audit.runsPage && sortedRuns.length > 0" class="pager">
      <span class="pager-count">
        Showing <span class="pg-strong">{{ showFrom(audit.runsPage.number, audit.runsPage.size, audit.runsPage.totalElements) }}</span>
        to <span class="pg-strong">{{ showTo(audit.runsPage.number, audit.runsPage.size, audit.runsPage.totalElements) }}</span>
        of <span class="pg-strong">{{ audit.runsPage.totalElements }}</span> Entries
      </span>
      <div class="pager-ctrls">
        <button class="pg-arrow" aria-label="Previous page" :disabled="audit.runsPage.number === 0" @click="changeRunsPage(audit.runsPage.number - 1)"><VIcon name="chevron-left" :size="16" /></button>
        <template v-for="(p, i) in pagesFor(audit.runsPage.totalPages, audit.runsPage.number)" :key="i">
          <span v-if="p === '…'" class="pg-ellipsis">…</span>
          <button v-else :class="['pg-num', { on: audit.runsPage.number + 1 === p }]" @click="changeRunsPage(Number(p) - 1)">{{ p }}</button>
        </template>
        <button class="pg-arrow" aria-label="Next page" :disabled="audit.runsPage.last" @click="changeRunsPage(audit.runsPage.number + 1)"><VIcon name="chevron-right" :size="16" /></button>
      </div>
    </div>
  </div>

  <!-- Events tab -->
  <div v-else-if="audit.eventsError && !audit.eventsLoading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load events</p>
    <p class="load-error-sub">{{ audit.eventsError }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="changeEventsPage(0)">Try again</VButton>
  </div>

  <div v-else class="tbl-wrap">
    <table class="tbl">
      <thead>
        <tr>
          <th><button class="th-sort" @click="toggleEventSort('event')">Event <VSortIcon :active="eventSortKey === 'event'" :dir="eventSortDir" /></button></th>
          <th><button class="th-sort" @click="toggleEventSort('cohort')">Cohort <VSortIcon :active="eventSortKey === 'cohort'" :dir="eventSortDir" /></button></th>
          <th><button class="th-sort" @click="toggleEventSort('actor')">Actor <VSortIcon :active="eventSortKey === 'actor'" :dir="eventSortDir" /></button></th>
          <th><button class="th-sort" @click="toggleEventSort('when')">When <VSortIcon :active="eventSortKey === 'when'" :dir="eventSortDir" /></button></th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>

      <tbody v-if="audit.eventsLoading">
        <tr v-for="i in 4" :key="i" class="skel-row">
          <td><span class="skel" style="width: 70%" /></td>
          <td><span class="skel" style="width: 60%" /></td>
          <td><span class="skel" style="width: 50%" /></td>
          <td><span class="skel" style="width: 90px" /></td>
          <td class="col-actions"><span class="skel" style="width: 18px; display: inline-block" /></td>
        </tr>
      </tbody>

      <tbody v-else>
        <tr v-for="e in sortedEvents" :key="e.id" class="row-click" @click="openEvent(e.id)">
          <td>
            <span class="event-cell">
              <span class="event-ic" :style="eventChipStyle(e.eventType)"><VIcon :name="eventIcon(e.eventType)" :size="14" /></span>
              {{ eventLabel(e.eventType) }}
            </span>
          </td>
          <td>{{ cohortLabel(e) }}</td>
          <td class="muted">{{ e.actorEmail ?? 'SYSTEM' }}</td>
          <td class="mono muted">{{ fmt(e.occurredAt) }}</td>
          <td class="col-actions">
            <button class="kebab" aria-label="Row actions" @click="toggleKebab($event, e.id)">
              <VIcon name="more-vertical" :size="18" />
            </button>
          </td>
        </tr>
        <tr v-if="sortedEvents.length === 0"><td colspan="5"><div class="empty-inline"><VIcon name="scroll-text" :size="24" class="muted" /><p class="empty-sub">No events match these filters.</p></div></td></tr>
      </tbody>
    </table>

    <div v-if="!audit.eventsLoading && audit.eventsPage && sortedEvents.length > 0" class="pager">
      <span class="pager-count">
        Showing <span class="pg-strong">{{ showFrom(audit.eventsPage.number, audit.eventsPage.size, audit.eventsPage.totalElements) }}</span>
        to <span class="pg-strong">{{ showTo(audit.eventsPage.number, audit.eventsPage.size, audit.eventsPage.totalElements) }}</span>
        of <span class="pg-strong">{{ audit.eventsPage.totalElements }}</span> Entries
      </span>
      <div class="pager-ctrls">
        <button class="pg-arrow" aria-label="Previous page" :disabled="audit.eventsPage.number === 0" @click="changeEventsPage(audit.eventsPage.number - 1)"><VIcon name="chevron-left" :size="16" /></button>
        <template v-for="(p, i) in pagesFor(audit.eventsPage.totalPages, audit.eventsPage.number)" :key="i">
          <span v-if="p === '…'" class="pg-ellipsis">…</span>
          <button v-else :class="['pg-num', { on: audit.eventsPage.number + 1 === p }]" @click="changeEventsPage(Number(p) - 1)">{{ p }}</button>
        </template>
        <button class="pg-arrow" aria-label="Next page" :disabled="audit.eventsPage.last" @click="changeEventsPage(audit.eventsPage.number + 1)"><VIcon name="chevron-right" :size="16" /></button>
      </div>
    </div>
  </div>

  <!-- Row actions popover -->
  <Teleport to="body">
    <div v-if="activeKebabId && kebabPos && tab === 'runs' && activeKebabRun" class="pop" :style="{ top: `${kebabPos.top}px`, left: `${kebabPos.left}px` }" @click.stop>
      <button class="pop-item" @click="toggleRun(activeKebabRun.id); closeKebab()">
        <VIcon name="chevrons-up-down" :size="15" />
        {{ expandedRun === activeKebabRun.id ? 'Hide details' : 'Show details' }}
      </button>
      <button v-if="activeKebabRun.syncJobId" class="pop-item" @click="openRunReview(activeKebabRun)">
        <VIcon name="arrow-right" :size="15" />
        Open run review
      </button>
    </div>
    <div v-else-if="activeKebabId && kebabPos && tab === 'events' && activeKebabEvent" class="pop" :style="{ top: `${kebabPos.top}px`, left: `${kebabPos.left}px` }" @click.stop>
      <button class="pop-item" @click="openEvent(activeKebabEvent.id)">
        <VIcon name="eye" :size="15" />
        View details
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.page-sub { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }
.muted { color: var(--text-secondary); }

/* Filter bar — rounded controls on the app background, matching the design system. */
.filter-bar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px; margin-bottom: 20px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow-card); }
.fld { display: flex; flex-direction: column; gap: 6px; }
.fld > span { font-size: 12px; font-weight: 500; color: var(--text-secondary); }
.fld select, .fld input { height: 40px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--bg-sunken); padding: 0 12px; font-family: inherit; font-size: 14px; color: var(--text); cursor: pointer; }
.fld input[type="date"] { font-family: var(--font-mono); }
.fld select:focus-visible, .fld input:focus-visible { outline: none; border-color: var(--navy); box-shadow: var(--ring-focus); }
.af-reset { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 12px; border: none; background: none; font-family: inherit; font-size: 14px; font-weight: 500; color: var(--text-secondary); cursor: pointer; }
.af-reset:hover { color: var(--navy); }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
.tab { background: none; border: none; padding: 10px 16px; font-family: inherit; font-size: 14px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; display: flex; align-items: center; gap: 8px; }
.tab.on { color: var(--navy); border-bottom-color: var(--navy); }
.count-badge { font-size: 11px; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 1px 7px; color: var(--text-secondary); }

.col-actions { width: 80px; text-align: right; }
.row-click { cursor: pointer; }
.cohort-name { font-weight: 600; }

/* Trigger */
.trigger-cell { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
.trigger-ic { color: var(--text-secondary); flex-shrink: 0; }

/* When (date over time) */
.when-cell { display: flex; flex-direction: column; gap: 3px; }
.when-date { font-size: 13px; color: var(--text); }
.when-time { font-size: 13px; color: var(--text-secondary); }

.detail-row td { background: var(--bg); }
.run-detail { display: flex; flex-direction: column; gap: 10px; padding: 6px 4px; }
.rd-counts { font-size: 13px; }
.rd-meta { font-size: 12px; }
.rd-hi-fail { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--danger); }
.rd-errors-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
.err-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.err-item { font-size: 12.5px; color: var(--danger); background: var(--danger-bg); padding: 6px 10px; border-radius: 3px; }
.rd-footer { display: flex; justify-content: flex-end; padding-top: 10px; margin-top: 2px; border-top: 1px solid var(--border); }

.event-cell { display: inline-flex; align-items: center; gap: 10px; font-weight: 500; }
.event-ic { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: var(--r-sm); flex-shrink: 0; }

/* Pager */
.pager-ctrls { display: flex; align-items: center; gap: 6px; }
.pg-arrow:disabled { opacity: 0.4; cursor: not-allowed; }

/* Row-actions popover */
.pop { position: fixed; z-index: 1000; background: #fff; border: 1px solid var(--border); border-radius: var(--r-md); box-shadow: var(--shadow-pop); min-width: 180px; overflow: hidden; padding: 4px; }
.pop-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: none; background: none; border-radius: var(--r-sm); font-family: inherit; font-size: 14px; color: var(--text); cursor: pointer; text-align: left; }
.pop-item:hover { background: var(--bg); }
.pop-item :deep(svg) { color: var(--text-secondary); }
</style>
