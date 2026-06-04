import { createRouter, createWebHistory } from 'vue-router'
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    allowedRole?: 'admin' | 'instructor'
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

    // 403
    {
      path: '/403',
      name: 'forbidden',
      component: () => import('@/views/ForbiddenView.vue'),
    },

    // Admin routes — shell layout renders for all children via <RouterView />
    {
      path: '/admin',
      redirect: '/admin/dashboard',
      component: () => import('@/views/admin/AdminDashboardView.vue'),
      meta: { requiresAuth: true, allowedRole: 'admin' },
      children: [
        { path: 'dashboard', name: 'admin-dashboard', component: () => import('@/views/admin/AdminHomeView.vue') },
        { path: 'cohorts',   name: 'admin-cohorts',   component: () => import('@/views/admin/CohortsView.vue') },
        { path: 'reference', name: 'admin-reference', component: () => import('@/views/admin/ReferenceDataView.vue') },
        { path: 'learners',  name: 'admin-learners',  component: () => import('@/views/admin/LearnersView.vue') },
        { path: 'users',     name: 'admin-users',     component: () => import('@/views/admin/UserManagementView.vue') },
        { path: 'reports',   name: 'admin-reports',   component: () => import('@/views/admin/ReportsView.vue') },
        { path: 'power-bi',  name: 'admin-power-bi',  component: () => import('@/views/admin/PowerBiView.vue') },
        { path: 'settings',  name: 'admin-settings',  component: () => import('@/views/admin/SettingsView.vue') },
      ],
    },

    // Instructor routes — shell layout renders for all children via <RouterView />
    {
      path: '/instructor',
      redirect: '/instructor/dashboard',
      component: () => import('@/views/instructor/InstructorDashboardView.vue'),
      meta: { requiresAuth: true, allowedRole: 'instructor' },
      children: [
        { path: 'dashboard', name: 'instructor-dashboard', component: () => import('@/views/instructor/InstructorHomeView.vue') },
        { path: 'template',  name: 'instructor-template',  component: () => import('@/views/instructor/DownloadTemplateView.vue') },
        { path: 'upload',    name: 'instructor-upload',    component: () => import('@/views/instructor/UploadResultsView.vue') },
        { path: 'uploads',   name: 'instructor-uploads',   component: () => import('@/views/instructor/MyUploadsView.vue') },
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
    return auth.mustChangePassword
      ? { name: 'set-password' }
      : { name: auth.isAdmin ? 'admin-dashboard' : 'instructor-dashboard' }
  }

  // Public routes — let through
  if (!to.meta.requiresAuth) return true

  // Must be authenticated to proceed past this point
  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Password change is mandatory — only /set-password is allowed
  if (auth.mustChangePassword && to.name !== 'set-password') {
    return { name: 'set-password' }
  }

  // Password already changed — no need to revisit /set-password
  if (!auth.mustChangePassword && to.name === 'set-password') {
    return { name: auth.isAdmin ? 'admin-dashboard' : 'instructor-dashboard' }
  }

  // Role enforcement — only when a route declares allowedRole
  if (to.meta.allowedRole && to.meta.allowedRole !== auth.user?.role) {
    return { name: 'forbidden' }
  }

  return true
}

router.beforeEach(navigationGuard)

export default router
