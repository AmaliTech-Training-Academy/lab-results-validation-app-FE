<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import VIcon from '@/components/base/VIcon.vue'

defineProps<{
  crumb: string
  userName: string
  userRole: string
  userInitials: string
}>()

const emit = defineEmits<{
  logout: []
}>()

const open = ref(false)
const wrap = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (wrap.value && !wrap.value.contains(e.target as Node)) close()
}

function toggle() {
  open.value = !open.value
  if (open.value) document.addEventListener('click', onDocClick)
  else document.removeEventListener('click', onDocClick)
}

function close() {
  open.value = false
  document.removeEventListener('click', onDocClick)
}

function onLogout() {
  close()
  emit('logout')
}

onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <header class="topbar">
    <nav class="crumbs" aria-label="Breadcrumb">
      <span>Home</span>
      <VIcon name="chevron-right" :size="15" />
      <span class="cur" aria-current="page">{{ crumb }}</span>
    </nav>

    <div class="topbar-right">
      <span v-if="userRole.toLowerCase() === 'instructor'" class="topbar-name">{{ userName }}</span>
<div ref="wrap" class="profile">
        <button
          class="profile-btn"
          type="button"
          aria-haspopup="menu"
          :aria-expanded="open"
          :aria-label="`Account menu for ${userName}`"
          @click="toggle"
        >
          <span class="avatar" role="img" :aria-label="userName">{{ userInitials }}</span>
          <VIcon name="chevron-down" :size="16" :class="['profile-caret', { open }]" />
        </button>

        <div v-if="open" class="profile-menu" role="menu">
          <div class="profile-meta">
            <div class="profile-name">{{ userName }}</div>
            <div class="profile-role">{{ userRole }}</div>
          </div>
          <button class="profile-item" type="button" role="menuitem" @click="onLogout">
            <VIcon name="log-out" :size="16" />
            Logout
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}


.profile {
  position: relative;
}

.profile-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 4px 4px;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
}
.profile-btn:hover {
  background: var(--bg);
}

.profile-caret {
  color: var(--text-secondary);
  transition: transform 0.15s ease;
}
.profile-caret.open {
  transform: rotate(180deg);
}

.profile-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 210px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-pop);
  padding: 6px;
  z-index: 50;
}

.profile-meta {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-soft);
  margin-bottom: 4px;
}
.profile-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}
.profile-role {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.profile-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  background: none;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.profile-item:hover {
  background: var(--danger-bg);
  color: var(--danger);
}
</style>
