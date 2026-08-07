<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'

withDefaults(
  defineProps<{
    activeId: string
    crumb: string
    userName: string
    userRole: string
    userInitials: string
    /** Let the content fill the full canvas width instead of the 1100px column. */
    wide?: boolean
  }>(),
  { wide: false },
)

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
      :active-id="activeId"
      :collapsed="collapsed"
      @navigate="$emit('navigate', $event)"
      @logout="$emit('logout')"
      @toggle="collapsed = !collapsed"
    />
    <div class="main">
      <AppTopbar
        :crumb="crumb"
        home-route="admin-dashboard"
        :user-name="userName"
        :user-role="userRole"
        :user-initials="userInitials"
        @logout="$emit('logout')"
      />
      <div id="main-content" class="content" tabindex="-1">
        <div :class="['container', { 'container-fluid': wide }]">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Cool light-grey app canvas (matches the dashboard mockup). Cards/topbar
   stay white and float on top. */
.main { background: var(--bg-sunken); }

/* Opt-in full-width content (e.g. wide data tables). Drops the 1100px column
   so the content fills the canvas, keeping only the .content 32px gutters. */
.container-fluid { max-width: none; }
</style>
