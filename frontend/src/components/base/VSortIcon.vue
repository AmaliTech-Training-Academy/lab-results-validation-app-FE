<script setup lang="ts">
import VIcon from './VIcon.vue'

// Design-system sort affordance: a "wide→narrow" sort glyph, dimmed when the
// column isn't the active sort and emphasised (navy) when it is. The arrow
// flips up/down to indicate ascending vs descending.
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
    :name="active && dir === 'asc' ? 'arrow-up-narrow-wide' : 'arrow-down-wide-narrow'"
    :size="14"
    :class="['v-sort', { on: active }]"
  />
</template>

<style scoped>
.v-sort {
  color: var(--navy);
  opacity: 0.4;
  flex-shrink: 0;
}
.v-sort.on {
  opacity: 1;
}
</style>
