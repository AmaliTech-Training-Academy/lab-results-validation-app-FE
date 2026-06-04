<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppShell from '@/components/layout/AppShell.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const NAV_TO_ROUTE: Record<string, string> = {
  'a-dashboard': 'admin-dashboard',
  'a-cohorts':   'admin-cohorts',
  'a-refdata':   'admin-reference',
  'a-learners':  'admin-learners',
  'a-users':     'admin-users',
  'a-reports':   'admin-reports',
  'a-powerbi':   'admin-power-bi',
  'a-settings':  'admin-settings',
}

const ROUTE_TO_NAV: Record<string, string> = Object.fromEntries(
  Object.entries(NAV_TO_ROUTE).map(([nav, r]) => [r, nav]),
)

const CRUMBS: Record<string, string> = {
  'admin-dashboard': 'Dashboard',
  'admin-cohorts':   'Cohorts',
  'admin-reference': 'Reference Data',
  'admin-learners':  'Learners',
  'admin-users':     'User Management',
  'admin-reports':   'Reports',
  'admin-power-bi':  'Power BI',
  'admin-settings':  'Settings',
}

const activeId = computed(() => ROUTE_TO_NAV[route.name as string] ?? 'a-dashboard')
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
    role="admin"
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
