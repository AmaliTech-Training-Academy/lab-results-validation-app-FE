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
  'a-runs':      'admin-runs',
  'a-audit':     'admin-audit',
  'a-settings':  'admin-settings',
}

// Route → active nav id. Child routes alias to their parent nav item.
const ROUTE_TO_NAV: Record<string, string> = {
  ...Object.fromEntries(Object.entries(NAV_TO_ROUTE).map(([nav, r]) => [r, nav])),
  'admin-cohort-standup': 'a-cohorts',
  'admin-cohort-detail':  'a-cohorts',
  'admin-run-review':     'a-runs',
}

const CRUMBS: Record<string, string> = {
  'admin-dashboard':      'Dashboard',
  'admin-cohorts':        'Cohorts',
  'admin-cohort-standup': 'Cohort stand-up',
  'admin-cohort-detail':  'Cohort detail',
  'admin-runs':           'Grading runs',
  'admin-run-review':     'Run review',
  'admin-audit':          'Audit',
  'admin-settings':       'Settings',
}

const activeId = computed(() => ROUTE_TO_NAV[route.name as string] ?? 'a-dashboard')
const crumb = computed(() => CRUMBS[route.name as string] ?? 'Dashboard')

// Routes whose content should fill the full canvas width (wide data tables).
const WIDE_ROUTES = new Set(['admin-runs'])
const wide = computed(() => WIDE_ROUTES.has(route.name as string))
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
    :active-id="activeId"
    :crumb="crumb"
    :wide="wide"
    :user-name="auth.user?.name ?? ''"
    :user-role="displayRole"
    :user-initials="auth.user?.initials ?? ''"
    @navigate="onNavigate"
    @logout="onLogout"
  >
    <RouterView />
  </AppShell>
</template>
