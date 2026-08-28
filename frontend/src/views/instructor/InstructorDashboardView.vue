<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppShell from '@/components/layout/AppShell.vue'
import { usePageTitle } from '@/composables/usePageTitle'

usePageTitle('Instructor Portal')

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const NAV_TO_ROUTE: Record<string, string> = {
  'i-dashboard': 'instructor-dashboard',
  'i-template':  'instructor-template',
  'i-upload':    'instructor-upload',
  'i-myuploads': 'instructor-uploads',
}

const ROUTE_TO_NAV: Record<string, string> = Object.fromEntries(
  Object.entries(NAV_TO_ROUTE).map(([nav, r]) => [r, nav]),
)

const CRUMBS: Record<string, string> = {
  'instructor-dashboard': 'Dashboard',
  'instructor-template':  'Download Template',
  'instructor-upload':    'Upload Results',
  'instructor-uploads':   'My Uploads',
}

const activeId = computed(() => ROUTE_TO_NAV[route.name as string] ?? 'i-dashboard')
const crumb = computed(() => CRUMBS[route.name as string] ?? 'Dashboard')
const displayRole = computed(() => {
  const r = auth.user?.role ?? ''
  return r.charAt(0).toUpperCase() + r.slice(1)
})

function onNavigate(id: string) {
  const name = NAV_TO_ROUTE[id]
  if (name) router.push({ name })
}

function onLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <AppShell
    role="instructor"
    :active-id="activeId"
    :crumb="crumb"
    :user-name="auth.user?.name ?? ''"
    :user-role="displayRole"
    :user-initials="auth.user?.initials ?? ''"
    @navigate="onNavigate"
    @logout="onLogout"
  >
    <RouterView />
  </AppShell>
</template>
