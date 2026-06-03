<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'success' | 'warning' | 'danger' | 'info'
  }>(),
  {
    tone: 'info',
  },
)
</script>

<template>
  <span :class="['pill', `pill-${tone}`]">
    <slot />
  </span>
</template>
