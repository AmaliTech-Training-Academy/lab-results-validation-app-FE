<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
  activeColor?: 'warning' | 'success' | 'danger'
}>()

defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="vtoggle" :class="{ 'vtoggle--disabled': disabled }">
    <button
      role="switch"
      type="button"
      class="vtoggle-track"
      :class="[modelValue && activeColor ? `vtoggle-track--${activeColor}` : modelValue ? 'vtoggle-track--on' : '']"
      :aria-checked="modelValue"
      :disabled="disabled"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span class="vtoggle-thumb" />
    </button>
    <span v-if="label" class="vtoggle-label">{{ label }}</span>
  </label>
</template>

<style scoped>
.vtoggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  cursor: pointer;
  user-select: none;
}
.vtoggle--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.vtoggle-track {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: var(--border);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.vtoggle-track--on      { background: var(--navy); }
.vtoggle-track--warning { background: var(--warning); }
.vtoggle-track--success { background: var(--success); }
.vtoggle-track--danger  { background: var(--danger); }

.vtoggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  display: block;
}
[aria-checked='true'] .vtoggle-thumb {
  transform: translateX(18px);
}

.vtoggle-label {
  font-size: 14px;
  color: var(--text);
}
</style>
