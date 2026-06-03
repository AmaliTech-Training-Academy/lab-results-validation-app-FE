<script setup lang="ts">
import VIcon from '@/components/base/VIcon.vue'

defineProps<{
  crumb: string
  userName: string
  userRole: string
  userInitials: string
}>()
</script>

<template>
  <header class="topbar">
    <div class="crumbs">
      <span>Home</span>
      <VIcon name="chevron-right" :size="15" />
      <span class="cur">{{ crumb }}</span>
    </div>
    <div class="topbar-right">
      <span v-if="userRole.toLowerCase() === 'instructor'" class="topbar-name">{{ userName }}</span>
      <span class="role-badge">{{ userRole }}</span>
      <div class="avatar">{{ userInitials }}</div>
    </div>
  </header>
</template>
