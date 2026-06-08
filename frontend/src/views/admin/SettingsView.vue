<script setup lang="ts">
import { ref } from 'vue'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const strictColumnOrder = ref(true)
const caseInsensitive = ref(true)
const uploadSummary = ref(true)
const highFailureDigest = ref(true)
</script>

<template>
  <div class="page-head">
    <div>
      <h1 class="page-title">Settings</h1>
      <p class="page-sub">Configure validation behaviour, notifications, and integrations.</p>
    </div>
  </div>

  <div class="set-stack">
    <!-- Validation preferences -->
    <section class="card">
      <div class="sec-head"><h2 class="sec-title">Validation preferences</h2></div>
      <div class="set-body">
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-row-title">Strict column order</div>
            <div class="set-row-desc">Require uploaded CSVs to match the template column order exactly.</div>
          </div>
          <div class="set-row-ctrl">
            <button
              type="button"
              class="toggle"
              :class="{ on: strictColumnOrder }"
              :aria-pressed="strictColumnOrder"
              @click="strictColumnOrder = !strictColumnOrder"
            ><span class="toggle-knob" /></button>
          </div>
        </div>
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-row-title">Case-insensitive matching</div>
            <div class="set-row-desc">
              Match lab titles and module names ignoring case — flags a warning when case differs from
              the configured form.
            </div>
          </div>
          <div class="set-row-ctrl">
            <button
              type="button"
              class="toggle"
              :class="{ on: caseInsensitive }"
              :aria-pressed="caseInsensitive"
              @click="caseInsensitive = !caseInsensitive"
            ><span class="toggle-knob" /></button>
          </div>
        </div>
        <div class="set-row last">
          <div class="set-row-text">
            <div class="set-row-title">Max attempts per lab</div>
            <div class="set-row-desc">Maximum submissions allowed per learner, per lab.</div>
          </div>
          <div class="set-row-ctrl">
            <button type="button" class="selectf-btn" style="width: 90px">
              <span>2</span>
              <VIcon name="chevron-down" :size="16" style="color: var(--text-secondary)" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Notifications -->
    <section class="card">
      <div class="sec-head"><h2 class="sec-title">Notifications</h2></div>
      <div class="set-body">
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-row-title">Upload-complete summary</div>
            <div class="set-row-desc">
              Email the uploading instructor an accepted / rejected summary when validation finishes.
            </div>
          </div>
          <div class="set-row-ctrl">
            <button
              type="button"
              class="toggle"
              :class="{ on: uploadSummary }"
              :aria-pressed="uploadSummary"
              @click="uploadSummary = !uploadSummary"
            ><span class="toggle-knob" /></button>
          </div>
        </div>
        <div class="set-row">
          <div class="set-row-text">
            <div class="set-row-title">High-failure admin digest</div>
            <div class="set-row-desc">Email admins when an upload's rejection rate exceeds the threshold below.</div>
          </div>
          <div class="set-row-ctrl">
            <button
              type="button"
              class="toggle"
              :class="{ on: highFailureDigest }"
              :aria-pressed="highFailureDigest"
              @click="highFailureDigest = !highFailureDigest"
            ><span class="toggle-knob" /></button>
          </div>
        </div>
        <div class="set-row last">
          <div class="set-row-text">
            <div class="set-row-title">High-failure threshold</div>
            <div class="set-row-desc">Rejection rate that triggers the admin digest.</div>
          </div>
          <div class="set-row-ctrl">
            <button type="button" class="selectf-btn" style="width: 100px">
              <span>50%</span>
              <VIcon name="chevron-down" :size="16" style="color: var(--text-secondary)" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Integrations -->
    <section class="card">
      <div class="sec-head"><h2 class="sec-title">Integrations</h2></div>
      <div class="set-body">
        <div class="set-row last">
          <div class="set-row-text">
            <div class="set-row-title">Power BI</div>
            <div class="set-row-desc">Read-only reporting views for dashboards. Connected · last synced today.</div>
          </div>
          <div class="set-row-ctrl">
            <VButton
              variant="ghost"
              size="sm"
              icon-right="arrow-right"
              @click="router.push({ name: 'admin-power-bi' })"
            >
              Manage
            </VButton>
          </div>
        </div>
      </div>
    </section>

    <!-- Data retention -->
    <section class="card">
      <div class="sec-head"><h2 class="sec-title">Data retention</h2></div>
      <div class="set-body">
        <div class="set-row last">
          <div class="set-row-text">
            <div class="set-row-title">Keep upload error reports</div>
            <div class="set-row-desc">How long to retain structured validation reports for audit.</div>
          </div>
          <div class="set-row-ctrl">
            <button type="button" class="selectf-btn" style="width: 170px">
              <span>Indefinitely</span>
              <VIcon name="chevron-down" :size="16" style="color: var(--text-secondary)" />
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
