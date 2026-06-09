<script setup lang="ts">
import VIcon from './VIcon.vue'

defineProps<{
  modelValue: string
  label?: string
  required?: boolean
  error?: string
  min?: string
  max?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <label class="ff">
    <span v-if="label" class="ff-label">
      {{ label }}<span v-if="required" style="color: var(--danger)"> *</span>
    </span>
    <div :class="['vdp', { 'vdp--error': error }]">
      <span class="vdp-icon"><VIcon name="calendar" :size="16" /></span>
      <input
        type="date"
        class="vdp-input"
        :value="modelValue"
        :min="min"
        :max="max"
        @change="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <span v-if="error" class="field-error" style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--danger)">
      <VIcon name="alert-circle" :size="13" />{{ error }}
    </span>
  </label>
</template>

<style scoped>
.vdp {
  position: relative;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.vdp:focus-within {
  border-color: var(--orange);
  box-shadow: var(--ring-focus);
}

.vdp--error {
  border-color: var(--danger);
}

.vdp--error:focus-within {
  box-shadow: 0 0 0 3px rgba(163, 45, 45, 0.2);
}

.vdp-icon {
  color: rgba(90, 104, 112, 0.7);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
}

.vdp-input {
  border: none;
  outline: none;
  flex: 1;
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--text);
  background: transparent;
  min-width: 0;
  cursor: pointer;
}

/* Stretch the native picker trigger over the entire field so clicking anywhere opens the calendar */
.vdp-input::-webkit-calendar-picker-indicator {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
</style>
