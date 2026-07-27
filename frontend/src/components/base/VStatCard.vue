<script setup lang="ts">
import VIcon from './VIcon.vue'

defineProps<{
  label: string
  value: string | number
  chipIcon: string
  chipBg: string
  chipFg: string
  footDot: string
  footText: string
}>()
</script>

<template>
  <div class="stat">
    <div class="stat-top">
      <div>
        <div class="stat-cap">{{ label }}</div>
        <div class="stat-num">{{ value }}</div>
      </div>
      <div class="stat-chip" :style="{ background: chipBg, color: chipFg }">
        <VIcon :name="chipIcon" :size="16" />
      </div>
    </div>
    <div class="stat-foot">
      <span class="dot" :style="{ background: footDot }" />
      {{ footText }}
    </div>
  </div>
</template>
