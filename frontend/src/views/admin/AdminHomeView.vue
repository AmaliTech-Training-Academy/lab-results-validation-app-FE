<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminDashboard, getCsvUploads } from '@/services/admin.service'
import { getInstructors } from '@/services/user.service'
import { getCohorts } from '@/services/cohort.service'
import { getLearners } from '@/services/learner.service'
import type { AdminDashboardData, Tone } from '@/types/dashboard.types'
import type { CsvUploadEntry } from '@/types/report.types'
import VStatCard from '@/components/base/VStatCard.vue'
import VPill from '@/components/base/VPill.vue'
import VIcon from '@/components/base/VIcon.vue'
import VButton from '@/components/base/VButton.vue'
import '@/assets/styles/dashboard.css'

const router = useRouter()

const STAT_ROUTES: Record<string, string> = {
  Cohorts: 'admin-cohorts',
  Learners: 'admin-learners',
  Instructors: 'admin-users',
}

function emailToName(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function deriveUploadTone(status: string): Tone {
  const s = status.toUpperCase()
  if (s === 'COMPLETED' || s === 'SUCCESS') return 'success'
  if (s === 'PARTIAL') return 'warning'
  return 'danger'
}

function deriveUploadStatus(status: string): string {
  const s = status.toUpperCase()
  if (s === 'COMPLETED' || s === 'SUCCESS') return 'Completed'
  if (s === 'PARTIAL') return 'Partial'
  return 'Failed'
}

function mapToRecentUpload(entry: CsvUploadEntry) {
  return {
    instructor: emailToName(entry.uploadedByEmail),
    file: entry.filename,
    accepted: entry.acceptedRows,
    rejected: entry.rejectedRows,
    tone: deriveUploadTone(entry.status),
    status: deriveUploadStatus(entry.status),
  }
}

function mapToAttentionItem(entry: CsvUploadEntry) {
  const total = entry.totalRows || 1
  const pct = Math.round((entry.rejectedRows / total) * 100)
  return {
    instructor: emailToName(entry.uploadedByEmail),
    file: entry.filename,
    pct: `${pct}% Rejected`,
    detail: `${entry.acceptedRows} Accepted / ${entry.rejectedRows} Rejected`,
  }
}

const data = ref<AdminDashboardData | null>(null)
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
    const [dashboard, instructors, cohortsPage, learnersPage, activeLearnersPage, uploadsPage] = await Promise.all([
      getAdminDashboard(),
      getInstructors(),
      getCohorts(0, 100),
      getLearners({ page: 0, size: 1 }),
      getLearners({ status: 'ACTIVE', page: 0, size: 1 }),
      getCsvUploads(0, 5),
    ])

    const activeInstructors = instructors.content.filter((i) => i.active).length
    const instructorStat = dashboard.stats.find((s) => s.label === 'Instructors')
    if (instructorStat) {
      instructorStat.value = String(instructors.totalElements)
      instructorStat.footText = `${activeInstructors} Active · ${instructors.totalElements - activeInstructors} Inactive`
    }

    const today = new Date().toISOString().split('T')[0]!
    const activeCohorts = cohortsPage.content.filter((c) => c.active && c.endDate >= today).length
    const completedCohorts = cohortsPage.content.filter((c) => c.endDate < today).length
    const archivedCohorts = cohortsPage.content.filter((c) => !c.active && c.endDate >= today).length
    const cohortStat = dashboard.stats.find((s) => s.label === 'Cohorts')
    if (cohortStat) {
      cohortStat.value = String(cohortsPage.totalElements)
      cohortStat.footText = `${activeCohorts} Active · ${completedCohorts} Completed · ${archivedCohorts} Archived`
    }

    const totalLearners = learnersPage.totalElements
    const activeLearners = activeLearnersPage.totalElements
    const archivedLearners = totalLearners - activeLearners
    const learnerStat = dashboard.stats.find((s) => s.label === 'Learners')
    if (learnerStat) {
      learnerStat.value = String(totalLearners)
      learnerStat.footText = `${activeLearners} Active · ${archivedLearners} Archived`
    }

    dashboard.recentUploads = uploadsPage.content.map(mapToRecentUpload)
    dashboard.attentionItems = uploadsPage.content
      .filter((e) => e.totalRows > 0 && e.rejectedRows / e.totalRows > 0.5)
      .map(mapToAttentionItem)

    data.value = dashboard
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    loadError.value = msg || 'Failed to load dashboard. Check your connection and try again.'
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
        <p class="page-sub">Overview of current validation system status.</p>
      </div>
    </div>
    <div class="stats">
      <div v-for="i in 4" :key="i" class="skel-stat" />
    </div>
    <div class="dash-grid" style="margin-top: 24px">
      <div class="card" style="overflow: hidden">
        <div style="padding: 20px 20px 0"><span class="skel" style="width: 140px; margin-bottom: 16px" /></div>
        <table class="tbl"><tbody>
          <tr v-for="i in 4" :key="i" class="skel-row">
            <td><span class="skel" style="width: 55%" /></td>
            <td><span class="skel mono" style="width: 70%" /></td>
            <td><span class="skel" style="width: 30px; display:inline-block" /></td>
            <td><span class="skel" style="width: 30px; display:inline-block" /></td>
            <td><span class="skel" style="width: 60px; border-radius: 999px; display:inline-block" /></td>
          </tr>
        </tbody></table>
      </div>
      <div class="card card-pad skel-card" />
    </div>
  </div>

  <div v-else-if="data">
    <div class="page-head">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">Overview of current validation system status.</p>
      </div>
    </div>

    <!-- Stat cards -->
    <div class="stats">
      <VStatCard
        v-for="s in data.stats"
        :key="s.label"
        :label="s.label"
        :value="s.value"
        :chip-icon="s.chipIcon"
        :chip-bg="s.chipBg"
        :chip-fg="s.chipFg"
        :foot-dot="s.footDot"
        :foot-text="s.footText"
        :style="STAT_ROUTES[s.label] ? 'cursor: pointer' : ''"
        @click="STAT_ROUTES[s.label] && router.push({ name: STAT_ROUTES[s.label] })"
      />
    </div>

    <div class="dash-grid">
      <!-- Recent uploads -->
      <div class="card">
        <div class="sec-head">
          <h2 class="sec-title">Recent uploads</h2>
          <button class="link" @click="router.push({ name: 'admin-reports' })">View all</button>
        </div>
        <div class="uploads-scroll">
          <table class="tbl">
            <thead>
              <tr>
                <th class="col-instructor">Instructor</th>
                <th class="col-file">File</th>
                <th class="col-accepted">Accepted</th>
                <th class="col-rejected">Rejected</th>
                <th class="col-status">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in data.recentUploads"
                :key="i"
                style="cursor: pointer"
                @click="router.push({ name: 'admin-reports' })"
              >
                <td class="col-instructor" style="font-weight: 500; white-space: nowrap">{{ row.instructor }}</td>
                <td class="col-file mono">{{ row.file }}</td>
                <td class="col-accepted">{{ row.accepted }}</td>
                <td
                  class="col-rejected"
                  :style="{
                    color: row.rejected > 0 ? 'var(--danger)' : 'inherit',
                    fontWeight: row.rejected > 0 ? 600 : 400,
                  }"
                >{{ row.rejected }}</td>
                <td class="col-status"><VPill :tone="row.tone">{{ row.status }}</VPill></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Attention required -->
      <div class="card card-pad">
        <div class="att-head">
          <VIcon name="alert-triangle" :size="22" color="#A83900" />
          <h2 class="sec-title">Attention required</h2>
        </div>
        <p class="att-intro">
          The following recent uploads have a rejection rate greater than 50%.
          Manual intervention may be required.
        </p>
        <div v-for="(a, i) in data.attentionItems" :key="i" class="att-item">
          <div class="att-row">
            <span class="att-who">Instructor: {{ a.instructor }}</span>
            <VPill tone="danger">{{ a.pct }}</VPill>
          </div>
          <div class="mono att-file">{{ a.file }}</div>
          <div class="att-foot">
            <span>{{ a.detail }}</span>
            <button class="link" @click="router.push({ name: 'admin-reports' })">View details →</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* ── Grid layout ──────────────────────────────────────────────────────────────
   At ≤1280 px the recent-uploads card shrinks to ~590 px (60 % of ~990 px
   content area). Stack both cards to full width instead.                       */
@media (max-width: 1280px) {
  .dash-grid { grid-template-columns: 1fr; }
}

/* ── Recent uploads table ─────────────────────────────────────────────────── */
.uploads-scroll { overflow-x: auto; }

/* Fixed-width columns so they don't collapse before scroll kicks in */
.col-accepted,
.col-rejected { width: 88px; }
.col-status   { width: 108px; }

/* File: truncate long names with ellipsis */
.col-file {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Column hiding at narrow stacked sizes ────────────────────────────────── */
/* ≤1100 px  →  content area ≈ 816 px.  Hide Accepted + Rejected (counts are
   visible in the full report); keeps the table clean on small desktops.        */
@media (max-width: 1100px) {
  .col-accepted,
  .col-rejected { display: none; }
}
</style>
