import { createRouter, createWebHistory } from 'vue-router'
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/login' },

    // Auth routes (public)
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
    },
    {
      path: '/set-password',
      name: 'set-password',
      component: () => import('@/views/auth/SetPasswordView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
    },

    // 403 — retained for unauthenticated redirects / defensive fallbacks
    {
      path: '/403',
      name: 'forbidden',
      component: () => import('@/views/ForbiddenView.vue'),
    },

    // Admin routes (single role) — shell layout renders children via <RouterView />
    {
      path: '/admin',
      redirect: '/admin/dashboard',
      component: () => import('@/views/admin/AdminLayoutView.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: 'dashboard', name: 'admin-dashboard', component: () => import('@/views/admin/AdminHomeView.vue') },
        { path: 'cohorts',   name: 'admin-cohorts',   component: () => import('@/views/admin/CohortsView.vue') },
        { path: 'cohorts/:id/standup', name: 'admin-cohort-standup', component: () => import('@/views/admin/CohortStandupView.vue') },
        { path: 'cohorts/:id',         name: 'admin-cohort-detail',  component: () => import('@/views/admin/CohortDetailView.vue') },
        { path: 'runs',      name: 'admin-runs',       component: () => import('@/views/admin/RunsView.vue') },
        { path: 'runs/:id',  name: 'admin-run-review', component: () => import('@/views/admin/RunReviewView.vue') },
        { path: 'audit',     name: 'admin-audit',      component: () => import('@/views/admin/AuditView.vue') },
        { path: 'sync-schedules', name: 'admin-sync-schedules', component: () => import('@/views/admin/SyncSchedulesView.vue') },
        { path: 'settings',  name: 'admin-settings',   component: () => import('@/views/admin/SettingsView.vue') },
      ],
    },

    // Catch-all → login
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
})

export function navigationGuard(to: RouteLocationNormalized): RouteLocationRaw | true {
  const auth = useAuthStore()

  // Authenticated users have no reason to see login — send them where they belong
  if (to.name === 'login' && auth.isAuthenticated) {
    return auth.mustChangePassword ? { name: 'set-password' } : { name: 'admin-dashboard' }
  }

  // Public routes — let through
  if (!to.meta.requiresAuth) return true

  // Password reset via email link — token in query param means unauthenticated access is valid
  if (to.name === 'set-password' && to.query.token) return true

  // Must be authenticated to proceed past this point
  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Password change is mandatory — only /set-password is allowed until it's done
  if (auth.mustChangePassword && to.name !== 'set-password') {
    return { name: 'set-password' }
  }

  // Password already changed — no need to revisit /set-password (unless it's a reset link)
  if (!auth.mustChangePassword && to.name === 'set-password' && !to.query.token) {
    return { name: 'admin-dashboard' }
  }

  // Single role: any authenticated admin may access all /admin/* surfaces.
  return true
}

router.beforeEach(navigationGuard)

export default router
