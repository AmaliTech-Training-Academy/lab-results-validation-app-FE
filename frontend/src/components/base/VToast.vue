<script setup lang="ts">
import { useToastStore } from '@/stores/toast'
import VIcon from './VIcon.vue'

const toast = useToastStore()

const iconMap: Record<string, string> = {
  success: 'check-circle',
  warning: 'alert-triangle',
  info: 'info',
}
</script>

<template>
  <Teleport to="body">
    <div v-if="toast.toast" :class="['toast', `toast-${toast.toast.tone}`]">
      <VIcon :name="iconMap[toast.toast.tone] ?? 'info'" :size="20" />
      <div class="toast-text">
        <div class="toast-title">{{ toast.toast.title }}</div>
        <div v-if="toast.toast.body" class="toast-body">{{ toast.toast.body }}</div>
      </div>
      <button class="toast-x" aria-label="Dismiss" @click="toast.dismiss()">
        <VIcon name="x" :size="16" />
      </button>
    </div>
  </Teleport>
</template>
