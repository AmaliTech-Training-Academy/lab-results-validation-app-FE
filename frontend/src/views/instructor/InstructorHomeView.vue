<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getInstructorDashboard, getInstructorModules } from '@/services/instructor.service'
import type { InstructorDashboardData } from '@/types/dashboard.types'
import VButton from '@/components/base/VButton.vue'
import VPill from '@/components/base/VPill.vue'
import VIcon from '@/components/base/VIcon.vue'
import '@/assets/styles/dashboard.css'

const auth = useAuthStore()
const router = useRouter()

const data = ref<InstructorDashboardData | null>(null)
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const loadSlow = ref(false)
const LOAD_TIMEOUT_MS = 8000

async function loadData() {
  isLoading.value = true
  loadError.value = null
  loadSlow.value = false
  const slowTimer = setTimeout(() => { loadSlow.value = true }, LOAD_TIMEOUT_MS)
  try {
    const instructorId = auth.user?.userId ?? ''
    const [dashboard, modules] = await Promise.all([
      getInstructorDashboard(),
      getInstructorModules(instructorId),
    ])
    data.value = { ...dashboard, modules }
  } catch {
    loadError.value = 'Failed to load dashboard. Check your connection and try again.'
  } finally {
    clearTimeout(slowTimer)
    isLoading.value = false
    loadSlow.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="dash">
  <div v-if="loadSlow && isLoading" class="load-slow-banner">
    <VIcon name="clock" :size="15" />
    This is taking longer than expected…
  </div>

  <div v-else-if="loadError && !isLoading" class="load-error-state">
    <div class="load-error-icon"><VIcon name="wifi-off" :size="28" /></div>
    <p class="load-error-title">Could not load dashboard</p>
    <p class="load-error-sub">{{ loadError }}</p>
    <VButton variant="ghost" icon="rotate-ccw" @click="loadData">Try again</VButton>
  </div>

  <div v-else-if="isLoading">
    <div class="page-head">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">Loading your workspace…</p>
      </div>
    </div>
    <h2 class="sec-title" style="margin-bottom: 16px">Assigned modules</h2>
    <div class="mod-grid">
      <div v-for="i in 3" :key="i" class="skel-card" style="border-radius: var(--r-md)" />
    </div>
    <div class="card" style="margin-top: 28px; overflow: hidden">
      <div class="sec-head sec-head-navy" style="background: var(--navy); padding: 16px 20px">
        <span class="skel" style="width: 160px; background: rgba(255,255,255,0.15)" />
      </div>
      <table class="tbl tbl-light"><tbody>
        <tr v-for="i in 3" :key="i" class="skel-row">
          <td><span class="skel mono" style="width: 65%" /></td>
          <td><span class="skel" style="width: 80px" /></td>
          <td><span class="skel" style="width: 30px; display:inline-block" /></td>
          <td><span class="skel" style="width: 30px; display:inline-block" /></td>
          <td><span class="skel" style="width: 60px; border-radius:999px; display:inline-block" /></td>
          <td><span class="skel" style="width: 60px; display:inline-block" /></td>
        </tr>
      </tbody></table>
    </div>
  </div>

  <div v-else-if="data">
    <div class="page-head">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">Welcome back, {{ auth.user?.name }}</p>
      </div>
    </div>

    <!-- Assigned modules -->
    <h2 class="sec-title" style="margin-bottom: 16px">Assigned modules</h2>

    <div v-if="data.modules.length === 0" class="mod-empty">
      <div class="mod-empty-icon">
        <VIcon name="inbox" :size="32" />
      </div>
      <p class="mod-empty-title">No modules assigned yet</p>
      <p class="mod-empty-sub">Your administrator hasn't assigned any modules to you. Contact them to get set up.</p>
    </div>

    <div v-else class="mod-grid">
      <div v-for="m in data.modules" :key="m.name" class="card card-pad mod-card">
        <div class="mod-top">
          <div>
            <h3 class="mod-name">{{ m.name }}</h3>
            <div class="mod-meta">{{ [m.cohort, m.specialization].filter(Boolean).join(' · ') }}</div>
          </div>
          <span class="lab-badge">
            <VIcon name="flask-conical" :size="14" />
            Lab
          </span>
        </div>
        <div class="mod-sub">
          <VIcon name="clipboard-check" :size="17" color="var(--text-secondary)" />
          {{ m.submitted }} results submitted
        </div>
        <VButton
          variant="primary"
          icon="upload-cloud"
          style="width: 100%"
          @click="router.push({ name: 'instructor-upload' })"
        >
          Upload results
        </VButton>
      </div>
    </div>

    <!-- My recent uploads -->
    <div class="card" style="margin-top: 28px">
      <div class="sec-head sec-head-navy">
        <h2 class="sec-title" style="color: #fff">My recent uploads</h2>
      </div>
      <div class="tbl-wrap" style="border: none; border-radius: 0; box-shadow: none">
        <table class="tbl tbl-light">
          <thead>
            <tr>
              <th>File</th>
              <th>Date</th>
              <th>Accepted</th>
              <th>Rejected</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in data.recentUploads" :key="i">
              <td>
                <span style="display: inline-flex; align-items: center; gap: 9px">
                  <VIcon name="file-text" :size="16" color="var(--text-secondary)" />
                  <span class="mono">{{ row.file }}</span>
                </span>
              </td>
              <td style="color: var(--text-secondary)">{{ row.date }}</td>
              <td>{{ row.accepted }}</td>
              <td
                :style="{
                  color: row.rejected > 0 ? 'var(--danger)' : 'inherit',
                  fontWeight: row.rejected > 0 ? 600 : 400,
                }"
              >{{ row.rejected }}</td>
              <td><VPill :tone="row.tone">{{ row.status }}</VPill></td>
              <td>
                <button
                  v-if="row.hasReport && row.uploadId"
                  class="link"
                  @click="router.push({ name: 'instructor-uploads', query: { uploadId: row.uploadId } })"
                >View report →</button>
                <span v-else style="color: var(--text-muted)">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.mod-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 24px;
  background: var(--surface);
  border: 1.5px dashed var(--border);
  border-radius: var(--r-md);
  text-align: center;
}

.mod-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--bg);
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.mod-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.mod-empty-sub {
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 340px;
  margin: 0;
  line-height: 1.5;
}
</style>
