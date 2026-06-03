<script setup lang="ts">
import VIcon from '@/components/base/VIcon.vue'

defineProps<{
  role: 'admin' | 'instructor'
  activeId: string
}>()

const emit = defineEmits<{
  navigate: [id: string]
  logout: []
}>()

interface NavItem {
  id: string
  label: string
  icon: string
}

const ADMIN_NAV: NavItem[] = [
  { id: 'a-dashboard', label: 'Dashboard',       icon: 'layout-dashboard' },
  { id: 'a-cohorts',   label: 'Cohorts',          icon: 'layers'           },
  { id: 'a-refdata',   label: 'Reference Data',   icon: 'folder-tree'      },
  { id: 'a-learners',  label: 'Learners',          icon: 'graduation-cap'   },
  { id: 'a-users',     label: 'User Management',  icon: 'users'            },
  { id: 'a-reports',   label: 'Reports',           icon: 'bar-chart-2'      },
  { id: 'a-powerbi',   label: 'Power BI',          icon: 'plug-zap'         },
]

const ADMIN_FOOTER: NavItem[] = [
  { id: 'a-settings', label: 'Settings', icon: 'settings' },
]

const INSTRUCTOR_NAV: NavItem[] = [
  { id: 'i-dashboard', label: 'Dashboard',          icon: 'layout-dashboard' },
  { id: 'i-template',  label: 'Download Template',  icon: 'file-down'        },
  { id: 'i-upload',    label: 'Upload Results',      icon: 'upload-cloud'     },
  { id: 'i-myuploads', label: 'My Uploads',          icon: 'files'            },
]

function navItems(role: 'admin' | 'instructor') {
  return role === 'instructor' ? INSTRUCTOR_NAV : ADMIN_NAV
}

function footerItems(role: 'admin' | 'instructor') {
  return role === 'instructor' ? [] : ADMIN_FOOTER
}
</script>

<template>
  <aside class="sidebar">
    <div>
      <div class="brand">
        <div class="mark">
          <VIcon name="microscope" :size="18" color="#fff" />
        </div>
        <div>
          <div class="name">Validata</div>
          <div class="sub">Internal Tool</div>
        </div>
      </div>
      <nav class="nav">
        <button
          v-for="item in navItems(role)"
          :key="item.id"
          :class="['nav-item', { active: activeId === item.id }]"
          type="button"
          @click="emit('navigate', item.id)"
        >
          <VIcon :name="item.icon" :size="18" />
          {{ item.label }}
        </button>
      </nav>
    </div>
    <div class="nav-foot">
      <button
        v-for="item in footerItems(role)"
        :key="item.id"
        :class="['nav-item', { active: activeId === item.id }]"
        type="button"
        @click="emit('navigate', item.id)"
      >
        <VIcon :name="item.icon" :size="18" />
        {{ item.label }}
      </button>
      <button class="nav-item" type="button" @click="emit('logout')">
        <VIcon name="log-out" :size="18" />
        Logout
      </button>
    </div>
  </aside>
</template>
