<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import VIcon from '@/components/base/VIcon.vue'

defineProps<{
  crumb: string
  homeRoute: string
  userName: string
  userRole: string
  userInitials: string
  userEmail?: string
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
      <RouterLink :to="{ name: homeRoute }">Home</RouterLink>
      <VIcon name="chevron-right" :size="15" />
      <span class="cur" aria-current="page">{{ crumb }}</span>
    </nav>

    <div class="topbar-right">
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

        <Transition name="menu-pop">
          <div v-if="open" class="profile-menu" role="menu">
            <div class="profile-meta">
              <span class="avatar avatar-lg" aria-hidden="true">{{ userInitials }}</span>
              <div class="profile-meta-text">
                <div class="profile-name-row">
                  <span class="profile-name">{{ userName }}</span>
                  <span class="role-badge">{{ userRole }}</span>
                </div>
                <div v-if="userEmail" class="profile-email">{{ userEmail }}</div>
              </div>
            </div>
            <div class="profile-divider" role="separator" />
            <button class="profile-item" type="button" role="menuitem" @click="onLogout">
              <VIcon name="log-out" :size="16" />
              Logout
            </button>
          </div>
        </Transition>
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
  gap: 9px;
  padding: 4px 8px 4px 4px;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.profile-btn:hover {
  background: var(--bg);
}
.profile-btn:hover .avatar {
  box-shadow: 0 0 0 3px var(--surface), 0 0 0 4px var(--navy);
}

/* Give the initials avatar a bit of presence against the white topbar —
   otherwise it reads as a flat, unfinished shape. */
.profile-btn .avatar {
  box-shadow: 0 0 0 2px var(--surface), 0 0 0 3px var(--border);
  transition: box-shadow 0.15s ease;
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
  top: calc(100% + 10px);
  min-width: 248px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-pop);
  padding: 6px;
  z-index: 50;
  transform-origin: top right;
}

.profile-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 10px 12px;
}
.avatar-lg {
  width: 40px;
  height: 40px;
  font-size: 15px;
  flex-shrink: 0;
}
.profile-meta-text {
  min-width: 0;
  flex: 1;
}
.profile-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.profile-name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile-email {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile-divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0 2px 6px;
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
  transition: background 0.12s ease, color 0.12s ease;
}
.profile-item:hover {
  background: var(--danger-bg);
  color: var(--danger);
}

/* Pop-in transition for the dropdown */
.menu-pop-enter-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.menu-pop-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
