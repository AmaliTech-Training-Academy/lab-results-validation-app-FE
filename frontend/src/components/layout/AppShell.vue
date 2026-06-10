<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'

defineProps<{
  role: 'admin' | 'instructor'
  activeId: string
  crumb: string
  userName: string
  userRole: string
  userInitials: string
}>()

defineEmits<{
  navigate: [id: string]
  logout: []
}>()
</script>

<template>
  <div class="app">
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <AppSidebar
      :role="role"
      :active-id="activeId"
      @navigate="$emit('navigate', $event)"
      @logout="$emit('logout')"
    />
    <div class="main">
      <AppTopbar
        :crumb="crumb"
        :user-name="userName"
        :user-role="userRole"
        :user-initials="userInitials"
      />
      <div id="main-content" class="content" tabindex="-1">
        <div class="container">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
