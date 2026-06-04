<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import VButton from '@/components/base/VButton.vue'
import VIcon from '@/components/base/VIcon.vue'

const auth = useAuthStore()
const router = useRouter()

function goToDashboard() {
  if (!auth.isAuthenticated) {
    router.push({ name: 'login' })
    return
  }
  router.push({ name: auth.isAdmin ? 'admin-dashboard' : 'instructor-dashboard' })
}
</script>

<template>
  <div class="forbidden-page">
    <div class="forbidden-card">
      <div class="forbidden-icon">
        <VIcon name="shield-x" :size="32" color="#A32D2D" />
      </div>
      <p class="t-eyebrow" style="color: var(--danger)">403 — Forbidden</p>
      <h1 class="t-display-md">Access denied</h1>
      <p class="t-body" style="color: var(--text-secondary); margin-top: 8px">
        You don't have permission to view this page.
      </p>
      <VButton variant="primary" icon-right="arrow-right" style="margin-top: 32px" @click="goToDashboard">
        Back to Dashboard
      </VButton>
    </div>
  </div>
</template>

<style scoped>
.forbidden-page {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.forbidden-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  padding: 48px 40px;
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.forbidden-icon {
  width: 64px;
  height: 64px;
  background: var(--danger-bg);
  border-radius: var(--r-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

h1 {
  margin-top: 4px;
}
</style>
