<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VToggle from '@/components/base/VToggle.vue'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'

const store = useSettingsStore()
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

onMounted(() => store.fetch())

async function save() {
  try {
    await store.update({ autoSendInstructorEmails: autoSend.value })
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
      <p class="page-sub">Notification policy for instructor grading digests.</p>
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
  </div>
</template>

<style scoped>
.page-sub { color: var(--text-secondary); font-size: 14px; margin-top: 4px; }
.muted { color: var(--text-secondary); }
</style>
