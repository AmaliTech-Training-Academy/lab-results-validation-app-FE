<script setup lang="ts">
import VIcon from '@/components/base/VIcon.vue'
import logoUrl from '@/assets/validata-logo.png'
import iconUrl from '@/assets/validata-icon.png'

withDefaults(
  defineProps<{
    activeId: string
    collapsed?: boolean
  }>(),
  { collapsed: false },
)

const emit = defineEmits<{
  navigate: [id: string]
  logout: []
  toggle: []
}>()

interface NavItem {
  id: string
  label: string
  icon: string
}

const ADMIN_NAV: NavItem[] = [
  { id: 'a-dashboard', label: 'Dashboard',     icon: 'layout-dashboard' },
  { id: 'a-cohorts',   label: 'Cohorts',       icon: 'layers'           },
  { id: 'a-runs',      label: 'Grading runs',  icon: 'refresh-cw'       },
  { id: 'a-audit',     label: 'Audit',         icon: 'scroll-text'      },
]

const ADMIN_FOOTER: NavItem[] = [
  { id: 'a-settings', label: 'Settings', icon: 'settings' },
]
</script>

<template>
  <aside :class="['sidebar', { collapsed }]" aria-label="Application navigation">
    <button
      class="sidebar-tab"
      type="button"
      :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      :aria-pressed="collapsed"
      @click="emit('toggle')"
    >
      <VIcon :name="collapsed ? 'chevron-right' : 'chevron-left'" :size="19" />
    </button>
    <div>
      <div class="brand">
        <img :src="logoUrl" alt="Validata" class="brand-logo" />
        <img :src="iconUrl" alt="Validata" class="brand-icon" />
      </div>
      <nav class="nav" aria-label="Main menu">
        <button
          v-for="item in ADMIN_NAV"
          :key="item.id"
          :class="['nav-item', { active: activeId === item.id }]"
          type="button"
          :title="collapsed ? item.label : undefined"
          :aria-current="activeId === item.id ? 'page' : undefined"
          @click="emit('navigate', item.id)"
        >
          <VIcon :name="item.icon" :size="18" />
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>
    </div>
    <div class="nav-foot">
      <button
        v-for="item in ADMIN_FOOTER"
        :key="item.id"
        :class="['nav-item', { active: activeId === item.id }]"
        type="button"
        :title="collapsed ? item.label : undefined"
        :aria-current="activeId === item.id ? 'page' : undefined"
        @click="emit('navigate', item.id)"
      >
        <VIcon :name="item.icon" :size="18" />
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
/* White sidebar (overrides the global navy styling) */
.sidebar {
  background: #fff;
  color: var(--text);
  border-right: 1px solid var(--border);
  transition: width 0.18s ease;
  z-index: 20;
}

/* Tab at the bottom tip of the sidebar's right edge */
.sidebar-tab {
  position: absolute;
  top: 14px;
  right: -16px;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 9px;
  background: var(--navy);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(8, 40, 59, 0.22);
  transition: background 0.15s;
}
.sidebar-tab:hover {
  background: var(--navy-2);
}

/* Brand: logo + small caption, left-aligned */
.brand {
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 4px 22px 22px;
}
.brand-logo {
  display: block;
  width: 116px;
  height: auto;
}
.brand-icon {
  display: none;
  width: 32px;
  height: auto;
}

/* ---------- Collapsed (icon rail) ---------- */
.sidebar.collapsed {
  width: 76px;
}
.sidebar.collapsed .brand {
  align-items: center;
  padding: 4px 0 22px;
}
.sidebar.collapsed .brand-logo {
  display: none;
}
.sidebar.collapsed .brand-icon {
  display: block;
}
.sidebar.collapsed .nav-label {
  display: none;
}
.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 10px;
}

/* Nav items become inset rounded pills with dark text */
.nav,
.nav-foot {
  padding-left: 12px;
  padding-right: 12px;
}
.nav { gap: 3px; }
.nav-item {
  color: var(--text-secondary);
  border-left: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 500;
}
.nav-item:hover {
  background: #F3F4F6;
  color: var(--text);
}
.nav-item.active {
  background: var(--navy);
  color: #fff;
  border-left: none;
}
.nav-item.active:hover {
  background: var(--navy-2);
  color: #fff;
}
</style>
