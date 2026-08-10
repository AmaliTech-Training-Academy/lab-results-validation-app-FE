<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VButton from '@/components/base/VButton.vue'
import VToggle from '@/components/base/VToggle.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import { useSettingsStore } from '@/stores/settings'
import { useSyncSchedulesStore } from '@/stores/syncSchedules'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const router = useRouter()
const store = useSettingsStore()
const syncSchedules = useSyncSchedulesStore()
const auth = useAuthStore()
const toast = useToastStore()

const autoSend = ref(false)

// Seed local editable state whenever the store loads/changes.
watch(
  () => store.settings,
  (s) => {
    if (!s) return
    autoSend.value = s.autoSendInstructorEmails
  },
  { immediate: true },
)

const dirty = computed(() => {
  const s = store.settings
  if (!s) return false
  return autoSend.value !== s.autoSendInstructorEmails
})

onMounted(() => {
  store.fetch()
  syncSchedules.fetchList()
})

async function save() {
  try {
    await store.update({ autoSendInstructorEmails: autoSend.value })
    toast.show({ tone: 'success', title: 'Settings saved' })
  } catch {
    toast.show({ tone: 'warning', title: 'Could not save settings', body: store.error ?? 'Please try again.' })
  }
}

// ── Account (read-only, sourced from the signed-in session) ────────────────
const roleLabel = computed(() => {
  const r = auth.user?.role
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : '—'
})

// ── Sync automation summary (read-only, links to the full schedules page) ──
const scheduleSummary = computed(() => {
  const list = syncSchedules.list
  return { total: list.length, enabled: list.filter((s) => s.enabled).length }
})

function goToSchedules() {
  router.push({ name: 'admin-sync-schedules' })
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1 class="page-title">Settings</h1>
      <p class="page-sub">Account details, notification policy, and sync automation at a glance.</p>
    </div>
    <div class="head-actions">
      <VPill v-if="dirty" tone="warning">Unsaved changes</VPill>
      <VButton size="sm" variant="primary" icon="check" :disabled="!dirty || store.saving" @click="save">
        {{ store.saving ? 'Saving…' : 'Save changes' }}
      </VButton>
    </div>
  </div>

  <!-- Load error -->
  <div v-if="store.error && !store.settings && !store.loading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load settings</p>
    <p class="load-error-sub">{{ store.error }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="store.fetch()">Try again</VButton>
  </div>

  <!-- Loading skeleton -->
  <div v-else-if="store.loading && !store.settings" class="set-stack">
    <div v-for="i in 3" :key="i" class="skel-card" />
  </div>

  <div v-else class="set-stack">
    <!-- Account -->
    <section class="card">
      <div class="sec-head">
        <div class="sec-head-lead">
          <span class="sec-chip" :style="{ background: 'var(--chip-blue-bg)', color: 'var(--chip-blue-fg)' }">
            <VIcon name="id-card" :size="16" />
          </span>
          <h2 class="sec-title">Account</h2>
        </div>
      </div>
      <div class="set-body">
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-row-title">Signed in as</div>
            <div class="set-row-desc">{{ auth.user?.name ?? '—' }} · {{ auth.user?.email ?? '—' }}</div>
          </div>
          <div class="set-row-ctrl">
            <VPill tone="info">{{ roleLabel }}</VPill>
          </div>
        </div>
        <div class="set-row last">
          <div class="set-row-text">
            <div class="set-row-title">Workspace</div>
            <div class="set-row-desc">Validata — SharePoint grading ingestion and lab-results validation for AmaliTech training cohorts.</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Notifications -->
    <section class="card">
      <div class="sec-head">
        <div class="sec-head-lead">
          <span class="sec-chip" :style="{ background: 'var(--chip-orange-bg)', color: 'var(--chip-orange-fg)' }">
            <VIcon name="mail" :size="16" />
          </span>
          <h2 class="sec-title">Notifications</h2>
        </div>
        <VPill :tone="autoSend ? 'warning' : 'success'">{{ autoSend ? 'Auto-sending' : 'Held for review' }}</VPill>
      </div>
      <div class="set-body">
        <div class="set-row" :class="{ last: !autoSend }">
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
        <div v-if="autoSend" class="short-dur-warn">
          <VIcon name="alert-triangle" :size="16" />
          <span>Grading digests will go out to instructors immediately after every run — there's no review step while this is on.</span>
        </div>
      </div>
    </section>

    <!-- Sync automation -->
    <section class="card">
      <div class="sec-head">
        <div class="sec-head-lead">
          <span class="sec-chip" :style="{ background: 'var(--chip-amber-bg)', color: 'var(--chip-amber-fg)' }">
            <VIcon name="calendar" :size="16" />
          </span>
          <h2 class="sec-title">Sync automation</h2>
        </div>
      </div>
      <div class="set-body">
        <div class="set-row last">
          <div class="set-row-text">
            <div class="set-row-title">Scheduled syncs</div>
            <div v-if="syncSchedules.loading" class="set-row-desc">Loading schedule summary…</div>
            <div v-else-if="syncSchedules.error" class="set-row-desc">Unable to load schedule summary right now.</div>
            <div v-else-if="scheduleSummary.total === 0" class="set-row-desc">
              No recurring sync schedules configured yet — grading data currently syncs by manual trigger only.
            </div>
            <div v-else class="set-row-desc">
              <strong>{{ scheduleSummary.enabled }}</strong> of {{ scheduleSummary.total }}
              schedule{{ scheduleSummary.total === 1 ? '' : 's' }} enabled.
            </div>
          </div>
          <div class="set-row-ctrl">
            <VButton size="sm" variant="ghost" icon="calendar-clock" @click="goToSchedules">
              {{ scheduleSummary.total === 0 ? 'Create schedule' : 'View schedules' }}
            </VButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-sub { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }

.head-actions { display: flex; align-items: center; gap: 12px; }

.sec-head-lead { display: flex; align-items: center; gap: 12px; }
.sec-chip { width: 32px; height: 32px; border-radius: var(--r-sm); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
</style>
