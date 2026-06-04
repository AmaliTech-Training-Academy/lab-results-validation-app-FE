<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminDashboard } from '@/services/admin.service'
import type { AdminDashboardData } from '@/types/dashboard.types'
import VStatCard from '@/components/base/VStatCard.vue'
import VPill from '@/components/base/VPill.vue'
import VIcon from '@/components/base/VIcon.vue'

const router = useRouter()

const data = ref<AdminDashboardData | null>(null)
const isLoading = ref(true)

onMounted(async () => {
  data.value = await getAdminDashboard()
  isLoading.value = false
})
</script>

<template>
  <div v-if="isLoading" class="empty">
    <div class="spinner" />
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
      />
    </div>

    <div class="dash-grid">
      <!-- Recent uploads -->
      <div class="card">
        <div class="sec-head">
          <h2 class="sec-title">Recent uploads</h2>
          <button class="link" @click="router.push({ name: 'admin-reports' })">View all</button>
        </div>
        <div class="tbl-wrap" style="border: none; border-radius: 0; box-shadow: none">
          <table class="tbl">
            <thead>
              <tr>
                <th>Instructor</th>
                <th>File</th>
                <th>Accepted</th>
                <th>Rejected</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in data.recentUploads"
                :key="i"
                style="cursor: pointer"
                @click="router.push({ name: 'admin-reports' })"
              >
                <td style="font-weight: 500">{{ row.instructor }}</td>
                <td class="mono">{{ row.file }}</td>
                <td>{{ row.accepted }}</td>
                <td
                  :style="{
                    color: row.rejected > 0 ? 'var(--danger)' : 'inherit',
                    fontWeight: row.rejected > 0 ? 600 : 400,
                  }"
                >{{ row.rejected }}</td>
                <td><VPill :tone="row.tone">{{ row.status }}</VPill></td>
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
</template>
