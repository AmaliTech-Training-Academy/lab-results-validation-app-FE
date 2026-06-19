<script setup lang="ts">
import { ref } from 'vue'
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

const collapsed = ref(false)
</script>

<template>
  <div class="app">
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <AppSidebar
      :role="role"
      :active-id="activeId"
      :collapsed="collapsed"
      @navigate="$emit('navigate', $event)"
      @logout="$emit('logout')"
      @toggle="collapsed = !collapsed"
    />
    <div class="main">
      <AppTopbar
        :crumb="crumb"
        :user-name="userName"
        :user-role="userRole"
        :user-initials="userInitials"
        @logout="$emit('logout')"
      />
      <div id="main-content" class="content" tabindex="-1">
        <div class="container">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Cool light-grey app canvas (matches the dashboard mockup). Cards/topbar
   stay white and float on top. */
.main { background: #ECEDEF; }
</style>
