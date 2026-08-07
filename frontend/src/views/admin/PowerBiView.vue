<script setup lang="ts">
import { ref } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import VPill from '@/components/base/VPill.vue'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()

const secretShown = ref(false)

const ENDPOINT = 'https://api.labvalidator.internal/v1/powerbi/sync'
const WORKSPACE_ID = 'wrk_8f92bd3a4c'
const CLIENT_SECRET = 'sk_test_4f98d2b1e6a7c390f1'

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.show({ tone: 'success', title: `${label} copied to clipboard` })
  } catch {
    toast.show({ tone: 'warning', title: 'Copy failed — please copy manually' })
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <div class="crumbs" style="margin-bottom: 6px">
        <span>Settings</span>
        <VIcon name="chevron-right" :size="14" />
        <span class="cur">Power BI Connection</span>
      </div>
      <h1 class="page-title">Power BI integration</h1>
    </div>
  </div>

  <div class="pbi-grid">
    <!-- Left column -->
    <div class="pbi-left">
      <!-- Connection status -->
      <div class="card card-pad">
        <h2 class="sec-title" style="margin-bottom: 16px">Connection status</h2>
        <VPill tone="success">
          <span class="dot" style="background: var(--success)" />
          Connected
        </VPill>
        <p class="page-sub" style="margin: 14px 0 16px">Last synced: Today, 10:42 AM EST</p>
        <VButton
          variant="ghost"
          icon="refresh-cw"
          style="width: 100%"
          @click="toast.show({ tone: 'success', title: 'Connection refreshed', body: 'Last synced: just now' })"
        >
          Refresh connection
        </VButton>
      </div>

      <!-- Configuration guide -->
      <div class="card card-pad">
        <h2 class="sec-title" style="margin-bottom: 14px">Configuration guide</h2>
        <ol class="pbi-steps">
          <li><span class="pbi-step-n">1</span><span>Open Power BI Desktop.</span></li>
          <li><span class="pbi-step-n">2</span><span>Select Get Data → Web API.</span></li>
          <li><span class="pbi-step-n">3</span><span>Paste the Endpoint URL.</span></li>
          <li>
            <span class="pbi-step-n">4</span>
            <span>Use Basic Auth with the Workspace ID as username and Client Secret as password.</span>
          </li>
        </ol>
        <button
          class="link"
          style="margin-top: 16px; display: inline-flex; align-items: center; gap: 6px; font-size: 14px"
          @click="toast.show({ tone: 'info', title: 'Download started' })"
        >
          <VIcon name="download" :size="16" />
          Download configuration guide (PDF)
        </button>
      </div>
    </div>

    <!-- Right column: API credentials -->
    <div class="card card-pad pbi-creds">
      <div class="pbi-creds-head">
        <h2 class="sec-title">API credentials</h2>
        <VIcon name="key-round" :size="20" style="color: var(--text-secondary)" />
      </div>

      <!-- Endpoint URL -->
      <div class="ff">
        <span class="ff-label">API Endpoint URL</span>
        <div class="copyfield">
          <span class="copyfield-val mono">{{ ENDPOINT }}</span>
          <button class="copyfield-btn" aria-label="Copy" @click="copyValue(ENDPOINT, 'API Endpoint URL')">
            <VIcon name="copy" :size="17" />
          </button>
        </div>
      </div>

      <!-- Workspace ID -->
      <div class="ff">
        <span class="ff-label">Workspace ID</span>
        <div class="copyfield">
          <span class="copyfield-val mono">{{ WORKSPACE_ID }}</span>
          <button class="copyfield-btn" aria-label="Copy" @click="copyValue(WORKSPACE_ID, 'Workspace ID')">
            <VIcon name="copy" :size="17" />
          </button>
        </div>
      </div>

      <!-- Client Secret -->
      <div class="ff">
        <span class="ff-label">Client Secret</span>
        <div class="copyfield">
          <span class="copyfield-val mono">{{ secretShown ? CLIENT_SECRET : '•'.repeat(22) }}</span>
          <button
            class="copyfield-btn"
            :aria-label="secretShown ? 'Hide' : 'Reveal'"
            @click="secretShown = !secretShown"
          >
            <VIcon :name="secretShown ? 'eye-off' : 'eye'" :size="17" />
          </button>
          <button class="copyfield-btn" aria-label="Copy" @click="copyValue(CLIENT_SECRET, 'Client Secret')">
            <VIcon name="copy" :size="17" />
          </button>
        </div>
      </div>

      <p class="ff-hint">Treat this secret like a password. Do not share it publicly.</p>

      <div class="pbi-regen">
        <VButton
          variant="primary"
          icon="refresh-cw"
          @click="toast.show({ tone: 'warning', title: 'Credential regeneration is not available in mock mode' })"
        >
          Regenerate credentials
        </VButton>
      </div>
    </div>
  </div>
</template>
