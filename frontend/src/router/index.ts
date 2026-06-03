import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Design system preview — dev only; import.meta.env.DEV is false in production
    // so the spread evaluates to [] and the DesignSystemView dynamic import is never bundled
    ...(import.meta.env.DEV
      ? [
          { path: '/', redirect: '/preview' },
          {
            path: '/preview',
            name: 'preview',
            component: () => import('@/views/DesignSystemView.vue'),
          },
        ]
      : []),

    // Auth routes (no shell)
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
    },
    {
      path: '/set-password',
      name: 'set-password',
      component: () => import('@/views/auth/SetPasswordView.vue'),
    },

    // Admin routes
    {
      path: '/admin',
      redirect: '/admin/dashboard',
      children: [
        { path: 'dashboard',    name: 'admin-dashboard',    component: () => import('@/views/admin/AdminDashboardView.vue') },
        { path: 'cohorts',      name: 'admin-cohorts',      component: () => import('@/views/admin/CohortsView.vue') },
        { path: 'reference',    name: 'admin-reference',    component: () => import('@/views/admin/ReferenceDataView.vue') },
        { path: 'learners',     name: 'admin-learners',     component: () => import('@/views/admin/LearnersView.vue') },
        { path: 'users',        name: 'admin-users',        component: () => import('@/views/admin/UserManagementView.vue') },
        { path: 'reports',      name: 'admin-reports',      component: () => import('@/views/admin/ReportsView.vue') },
        { path: 'power-bi',     name: 'admin-power-bi',     component: () => import('@/views/admin/PowerBiView.vue') },
        { path: 'settings',     name: 'admin-settings',     component: () => import('@/views/admin/SettingsView.vue') },
      ],
    },

    // Instructor routes
    {
      path: '/instructor',
      redirect: '/instructor/dashboard',
      children: [
        { path: 'dashboard', name: 'instructor-dashboard', component: () => import('@/views/instructor/InstructorDashboardView.vue') },
        { path: 'template',  name: 'instructor-template',  component: () => import('@/views/instructor/DownloadTemplateView.vue') },
        { path: 'upload',    name: 'instructor-upload',    component: () => import('@/views/instructor/UploadResultsView.vue') },
        { path: 'uploads',   name: 'instructor-uploads',   component: () => import('@/views/instructor/MyUploadsView.vue') },
      ],
    },

    // Catch-all → login
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
})

export default router
