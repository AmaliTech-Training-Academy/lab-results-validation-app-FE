<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VToggle from '@/components/base/VToggle.vue'
import VIcon from '@/components/base/VIcon.vue'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'

const store = useSettingsStore()
const toast = useToastStore()

const autoSend = ref(false)
const schedule = ref({ enabled: true, day: 'MONDAY', time: '08:00', timezone: 'GMT' })

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
const TIMEZONES = ['GMT', 'UTC', 'Africa/Accra', 'Europe/London']

// Seed local editable state whenever the store loads/changes.
watch(
  () => store.settings,
  (s) => {
    if (!s) return
    autoSend.value = s.autoSendInstructorEmails
    schedule.value = { ...s.syncSchedule }
  },
  { immediate: true },
)

const dirty = computed(() => {
  const s = store.settings
  if (!s) return false
  return (
    autoSend.value !== s.autoSendInstructorEmails ||
    schedule.value.enabled !== s.syncSchedule.enabled ||
    schedule.value.day !== s.syncSchedule.day ||
    schedule.value.time !== s.syncSchedule.time ||
    schedule.value.timezone !== s.syncSchedule.timezone
  )
})

onMounted(() => store.fetch())

async function save() {
  try {
    await store.update({ autoSendInstructorEmails: autoSend.value, syncSchedule: { ...schedule.value } })
    toast.show({ tone: 'success', title: 'Settings saved' })
  } catch {
    toast.show({ tone: 'warning', title: 'Could not save settings', body: store.error ?? 'Please try again.' })
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1 class="page-title">Settings</h1>
      <p class="page-sub">Notification policy and the weekly grading-sync schedule.</p>
    </div>
    <VButton variant="primary" icon="check" :disabled="!dirty || store.saving" @click="save">
      {{ store.saving ? 'Saving…' : 'Save changes' }}
    </VButton>
  </div>

  <div v-if="store.loading && !store.settings" class="muted">Loading settings…</div>

  <div v-else class="set-stack">
    <!-- Notifications -->
    <section class="card">
      <div class="sec-head"><h2 class="sec-title">Notifications</h2></div>
      <div class="set-body">
        <div class="set-row last">
          <div class="set-row-text">
            <div class="set-row-title">Auto-send instructor emails</div>
            <div class="set-row-desc">
              When on, per-run instructor grading digests are sent automatically. When off (default), they are
              <strong>held</strong> for review on each run's page before you send them.
            </div>
          </div>
          <div class="set-row-ctrl">
            <VToggle v-model="autoSend" active-color="success" />
          </div>
        </div>
      </div>
    </section>

    <!-- Grading sync schedule -->
    <section class="card">
      <div class="sec-head"><h2 class="sec-title">Grading sync schedule</h2></div>
      <div class="set-body">
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-row-title">Scheduled sync</div>
            <div class="set-row-desc">Automatically ingest grading sheets for stood-up cohorts on a recurring schedule.</div>
          </div>
          <div class="set-row-ctrl"><VToggle v-model="schedule.enabled" /></div>
        </div>

        <div class="set-row last" :class="{ 'set-row--disabled': !schedule.enabled }">
          <div class="set-row-text">
            <div class="set-row-title">Run every</div>
            <div class="set-row-desc">Day and time the weekly sync runs.</div>
          </div>
          <div class="set-row-ctrl schedule-ctrl">
            <select v-model="schedule.day" :disabled="!schedule.enabled" aria-label="Sync day">
              <option v-for="d in DAYS" :key="d" :value="d">{{ d.charAt(0) + d.slice(1).toLowerCase() }}</option>
            </select>
            <input v-model="schedule.time" type="time" :disabled="!schedule.enabled" aria-label="Sync time" />
            <select v-model="schedule.timezone" :disabled="!schedule.enabled" aria-label="Timezone">
              <option v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz }}</option>
            </select>
          </div>
        </div>
      </div>
      <p class="provisional-note">
        <VIcon name="info" :size="14" />
        Schedule timing is provisional (pending decision D-TRIG). The default is Monday 08:00 GMT.
      </p>
    </section>
  </div>
</template>

<style scoped>
.page-sub { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }
.muted { color: var(--text-secondary); }

.schedule-ctrl { display: flex; gap: 8px; }
.schedule-ctrl select,
.schedule-ctrl input {
  height: 38px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm, 4px);
  background: #fff;
  padding: 0 10px;
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
}
.schedule-ctrl input[type='time'] { font-family: var(--font-mono); }
.schedule-ctrl select:focus-visible,
.schedule-ctrl input:focus-visible { outline: none; border-color: var(--orange); box-shadow: var(--ring-focus); }

.set-row--disabled { opacity: 0.55; }

.provisional-note {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12.5px;
  padding: 12px 20px 4px;
}
</style>
