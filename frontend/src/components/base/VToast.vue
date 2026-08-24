<script setup lang="ts">
import { useToastStore } from '@/stores/toast'
import VIcon from './VIcon.vue'

const toast = useToastStore()

const iconMap: Record<string, string> = {
  success: 'check-circle',
  warning: 'alert-triangle',
  info: 'info',
  danger: 'alert-circle',
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack">
      <div
        v-for="t in toast.toasts"
        :key="t.id"
        :class="['toast', `toast-${t.tone}`]"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <VIcon :name="iconMap[t.tone] ?? 'info'" :size="20" />
        <div class="toast-text">
          <div class="toast-title">{{ t.title }}</div>
          <div v-if="t.body" class="toast-body">{{ t.body }}</div>
          <button v-if="t.action" class="toast-action" type="button" @click="t.action.onClick()">
            {{ t.action.label }}
          </button>
        </div>
        <button class="toast-x" type="button" aria-label="Dismiss notification" @click="toast.dismiss(t.id)">
          <VIcon name="x" :size="16" />
        </button>
      </div>
    </div>
  </Teleport>
</template>
