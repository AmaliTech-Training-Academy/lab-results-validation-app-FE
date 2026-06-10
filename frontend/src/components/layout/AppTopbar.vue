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
    <nav class="crumbs" aria-label="Breadcrumb">
      <span>Home</span>
      <VIcon name="chevron-right" :size="15" />
      <span class="cur" aria-current="page">{{ crumb }}</span>
    </nav>
    <div class="topbar-right">
      <span v-if="userRole.toLowerCase() === 'instructor'" class="topbar-name">{{ userName }}</span>
      <span class="role-badge">{{ userRole }}</span>
      <div class="avatar" role="img" :aria-label="userName">{{ userInitials }}</div>
    </div>
  </header>
</template>
