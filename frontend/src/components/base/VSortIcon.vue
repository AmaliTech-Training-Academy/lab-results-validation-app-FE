<script setup lang="ts">
import VIcon from './VIcon.vue'

// Design-system sort affordance: an up/down (↑↓) arrow shown on every sortable
// header, dimmed when the column isn't the active sort. When it IS active the
// glyph collapses to the single direction (↑ asc / ↓ desc) at full strength.
withDefaults(
  defineProps<{
    active?: boolean
    dir?: 'asc' | 'desc'
  }>(),
  { active: false, dir: 'desc' },
)
</script>

<template>
  <VIcon
    :name="active ? (dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down'"
    :size="14"
    :class="['v-sort', { on: active }]"
  />
</template>

<style scoped>
.v-sort {
  color: var(--navy);
  opacity: 0.7;
  flex-shrink: 0;
}
.v-sort.on {
  opacity: 1;
}
</style>
