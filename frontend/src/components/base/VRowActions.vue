<script setup lang="ts">
import { computed, ref } from 'vue'
import VIcon from './VIcon.vue'
import VPopover from './VPopover.vue'

/**
 * The standard "⋮" row-actions menu shared by every admin table. Previously
 * this kebab/popover pair was hand-rolled per view (positioned once, no
 * Escape handling, no focus management) — and in LearnersView rebuilt from
 * inline styles.
 */
const props = defineProps<{
  /** Unique id of the row whose menu is open (`null` when closed). */
  activeId: string | null
  rowId: string
}>()

const emit = defineEmits<{
  toggle: [payload: { id: string; anchor: HTMLElement }]
  close: []
}>()

const trigger = ref<HTMLElement | null>(null)
const anchorEl = computed(() => trigger.value)

function onClick() {
  if (props.activeId === props.rowId) {
    emit('close')
    return
  }
  if (trigger.value) emit('toggle', { id: props.rowId, anchor: trigger.value })
}
</script>

<template>
  <button
    ref="trigger"
    class="kebab"
    aria-label="Row actions"
    aria-haspopup="menu"
    :aria-expanded="activeId === rowId"
    @click.stop="onClick"
  >
    <VIcon name="more-vertical" :size="18" />
  </button>
  <VPopover :open="activeId === rowId" :anchor="anchorEl" @close="emit('close')">
    <slot />
  </VPopover>
</template>
