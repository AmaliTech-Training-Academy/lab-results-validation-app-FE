<script setup lang="ts">
import { computed } from 'vue'
import * as icons from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    color?: string
  }>(),
  {
    size: 18,
    color: 'currentColor',
  },
)

const icon = computed(() => {
  const key = props.name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  const resolved = (icons as Record<string, unknown>)[key] ?? null
  if (import.meta.env.DEV && !resolved) {
    console.warn(`[VIcon] Unknown icon name: "${props.name}" (resolved key: "${key}")`)
  }
  return resolved
})
</script>

<template>
  <component :is="icon" v-if="icon" :size="size" :color="color" aria-hidden="true" focusable="false" />
</template>
