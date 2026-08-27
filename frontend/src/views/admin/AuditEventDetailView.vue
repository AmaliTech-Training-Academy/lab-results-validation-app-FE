<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import { useAuditStore } from '@/stores/audit'
import { useCohortsStore } from '@/stores/cohorts'
import { EVENT_TYPE_TONE, EVENT_TYPE_ICON, TONE_CHIP_STYLE, type AuditEventType } from '@/types/audit.types'

const route = useRoute()
const audit = useAuditStore()
const cohorts = useCohortsStore()

const eventId = route.params.id as string
const event = computed(() => audit.currentEvent)

function eventIcon(t: string): string {
  return EVENT_TYPE_ICON[t as AuditEventType] ?? 'circle'
}
/** Same chip motif as the events list, so an event reads as the same thing in both places. */
function eventChipStyle(t: string) {
  return TONE_CHIP_STYLE[EVENT_TYPE_TONE[t as AuditEventType] ?? 'info']
}
function eventLabel(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function retry() {
  audit.fetchEvent(eventId)
}
function fmt(iso?: string): string {
  return iso ? `${iso.replace('T', ' ').slice(0, 19)} UTC` : '—'
}
/** Neither the run nor the event endpoint denormalizes the cohort name — look it up. */
const cohortLabel = computed(() => {
  if (!event.value) return '—'
  if (!event.value.cohortId) return 'SYSTEM-wide'
  return cohorts.list.find((c) => c.id === event.value!.cohortId)?.name ?? event.value.cohortId
})
const payloadEntries = computed(() => Object.entries(event.value?.payload ?? {}))

/** Gate/standup payloads mix booleans, numbers, arrays, and nested objects — a bare `JSON.stringify` reads badly for anything but a plain string, e.g. `quizReferencePresent: true` showing as the text "true", or `null` showing as the text "null". */
type PayloadValueKind = 'bool' | 'empty' | 'list' | 'json' | 'enum' | 'text'

/** e.g. conflict-resolution payloads carry a raw `conflictKind`/`action` code (`in_file_duplicate`, `KEEP_INCOMING`) — snake_case in either case, not prose. IDs like `conflictId`/`labId` never contain underscores, so they fall through to plain text untouched. */
function isEnumLike(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9]+(_[a-z0-9]+)+$/i.test(v)
}
function payloadKind(v: unknown): PayloadValueKind {
  if (typeof v === 'boolean') return 'bool'
  if (v === null || v === undefined) return 'empty'
  if (Array.isArray(v)) return v.every((x) => x === null || typeof x !== 'object') ? 'list' : 'json'
  if (typeof v === 'object') return 'json'
  if (isEnumLike(v)) return 'enum'
  return 'text'
}
function payloadList(v: unknown): string {
  return Array.isArray(v) && v.length ? v.map((x) => String(x)).join(', ') : '—'
}
function payloadJson(v: unknown): string {
  return JSON.stringify(v, null, 2)
}
/** Backend enums show up in either case — `conflictKind` is `in_file_duplicate`, `action` is `KEEP_INCOMING` — so
 * lowercase first or the two read inconsistently side by side ("In File Duplicate" next to "KEEP INCOMING"). */
function payloadEnum(v: unknown): string {
  return String(v).toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

onMounted(() => {
  cohorts.fetchList()
  audit.fetchEvent(eventId)
})
</script>

<template>
  <div class="page-head">
    <div>
      <RouterLink :to="{ name: 'admin-audit', query: { tab: 'events' } }" class="back-link">
        <VIcon name="chevron-left" :size="15" /> Audit
      </RouterLink>
      <h1 class="page-title">
        <span v-if="event" class="event-ic-lg" :style="eventChipStyle(event.eventType)">
          <VIcon :name="eventIcon(event.eventType)" :size="20" />
        </span>
        {{ event ? eventLabel(event.eventType) : 'Lifecycle event' }}
      </h1>
      <p class="page-sub mono">{{ eventId }}</p>
    </div>
  </div>

  <div v-if="audit.currentEventLoading" class="meta-grid">
    <div v-for="i in 3" :key="i" class="meta-cell">
      <span class="skel" style="width: 40%" />
      <span class="skel" style="width: 70%; margin-top: 10px; height: 18px" />
    </div>
  </div>

  <div v-else-if="audit.currentEventError" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load this event</p>
    <p class="load-error-sub">{{ audit.currentEventError }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="retry">Try again</VButton>
  </div>

  <template v-else-if="event">
    <dl class="meta-grid">
      <div class="meta-cell">
        <dt>Cohort</dt>
        <dd>{{ cohortLabel }}</dd>
      </div>
      <div class="meta-cell">
        <dt>Actor</dt>
        <dd>{{ event.actorEmail ?? 'SYSTEM' }}</dd>
      </div>
      <div class="meta-cell">
        <dt>Occurred at</dt>
        <dd class="mono">{{ fmt(event.occurredAt) }}</dd>
      </div>
    </dl>
    <p v-if="cohorts.error && event.cohortId" class="inline-error" style="margin: -16px 0 24px"><VIcon name="alert-circle" :size="14" /> {{ cohorts.error }}</p>

    <h2 class="block-title">Payload</h2>
    <div v-if="payloadEntries.length" class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          <tr v-for="[k, v] in payloadEntries" :key="k">
            <td class="mono" style="font-weight: 500">{{ k }}</td>
            <td class="mono">
              <span v-if="payloadKind(v) === 'bool'" class="payload-bool" :class="v ? 'yes' : 'no'">
                <VIcon :name="v ? 'check-circle-2' : 'x-circle'" :size="14" />
                {{ v ? 'Yes' : 'No' }}
              </span>
              <span v-else-if="payloadKind(v) === 'empty'" class="muted">—</span>
              <span v-else-if="payloadKind(v) === 'list'">{{ payloadList(v) }}</span>
              <span v-else-if="payloadKind(v) === 'enum'">{{ payloadEnum(v) }}</span>
              <pre v-else-if="payloadKind(v) === 'json'" class="payload-json">{{ payloadJson(v) }}</pre>
              <template v-else>{{ v }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="muted">No additional payload for this event.</p>
  </template>
</template>

<style scoped>
.back-link { display: inline-flex; align-items: center; gap: 2px; color: var(--text-secondary); font-size: 13px; font-weight: 500; margin-bottom: 8px; }
.back-link:hover { color: var(--navy); }
.page-title { display: flex; align-items: center; gap: 12px; }
.muted { color: var(--text-secondary); }

.event-ic-lg { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--r-md); flex-shrink: 0; }

.meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 28px; }
.meta-cell { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 14px 16px; box-shadow: var(--shadow-card); }
.meta-cell dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
.meta-cell dd { font-size: 15px; font-weight: 500; color: var(--text); margin-top: 4px; word-break: break-word; }

.block-title { font-family: var(--font-display); font-weight: 600; font-size: 16px; color: var(--text); margin-bottom: 12px; }

.payload-bool { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; }
.payload-bool.yes { color: var(--success); }
.payload-bool.no { color: var(--danger); }
.payload-json { margin: 0; padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-sm); max-width: 480px; max-height: 200px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
</style>
