<script setup lang="ts">
import VIcon from './VIcon.vue'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger'
    size?: 'md' | 'sm'
    icon?: string
    iconRight?: string
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
  },
)

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <button
    :class="['btn', `btn-${variant}`, { 'btn-sm': size === 'sm' }]"
    :type="type"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <VIcon v-if="icon" :name="icon" :size="size === 'sm' ? 16 : 17" />
    <slot />
    <VIcon v-if="iconRight" :name="iconRight" :size="size === 'sm' ? 16 : 17" />
  </button>
</template>
