<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'

/**
 * Small anchored popover (row actions · column picker · filters) that replaces
 * the per-view teleported `.pop` divs. Improvements over those:
 * - flips above / shifts horizontally when it would overflow the viewport
 * - closes on Escape and outside click
 * - focuses its first focusable element on open, restores focus on close
 * - repositions on scroll/resize while open
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    /** Element (usually the trigger button) to anchor to. */
    anchor: HTMLElement | null
    width?: number
  }>(),
  { width: 200 },
)

const emit = defineEmits<{ close: [] }>()

const root = ref<HTMLElement | null>(null)
const pos = ref<{ top: number; left: number } | null>(null)
const align = ref<'left' | 'right'>('right')

const MENU_MARGIN = 8

function position() {
  if (!props.anchor || !root.value) return
  const r = props.anchor.getBoundingClientRect()
  const my = root.value.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Vertical: prefer below the anchor; flip above when clipped, then clamp.
  let top = r.bottom + 6
  if (top + my.height > vh - MENU_MARGIN) {
    const above = r.top - 6 - my.height
    top = above >= MENU_MARGIN ? above : Math.max(MENU_MARGIN, vh - my.height - MENU_MARGIN)
  }

  // Horizontal: right-align to the trigger by default, shifting left when it
  // would overflow; keep left-aligned only when there's no room on either side.
  let left = r.right - props.width
  align.value = 'right'
  if (left < MENU_MARGIN) {
    left = r.left
    align.value = 'left'
    if (left + props.width > vw - MENU_MARGIN) {
      left = Math.max(MENU_MARGIN, vw - props.width - MENU_MARGIN)
    }
  }
  pos.value = { top, left }
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]'

function onDocClick(e: MouseEvent) {
  const t = e.target as Node
  if (props.anchor?.contains(t) || root.value?.contains(t)) return
  emit('close')
  const target = t as HTMLElement
  if (!(target.matches?.(FOCUSABLE))) {
    props.anchor?.focus()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    props.anchor?.focus()
  }
}

function reposition() {
  if (props.open) position()
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      // `position()` needs `root` mounted to measure its size, but the template only
      // renders `root` once `pos` is set — render off-screen first so it exists to
      // measure, then correct the position before the next paint.
      pos.value = { top: -9999, left: -9999 }
      await nextTick()
      position()
      document.addEventListener('click', onDocClick)
      window.addEventListener('scroll', reposition, true)
      window.addEventListener('resize', reposition)
      const first = root.value?.querySelector<HTMLElement>('button, input, select, a[href]')
      first?.focus()
    } else {
      document.removeEventListener('click', onDocClick)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      pos.value = null
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('scroll', reposition, true)
  window.removeEventListener('resize', reposition)
})

defineExpose({ alignment: computed(() => align.value) })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && pos"
      ref="root"
      class="pop"
      :class="{ 'pop--left': align === 'left' }"
      :style="{ top: `${pos.top}px`, left: `${pos.left}px`, minWidth: `${width}px` }"
      role="dialog"
      aria-label="Options"
      @keydown="onKeydown"
      @click.stop
    >
      <slot />
    </div>
  </Teleport>
</template>

<style scoped>
.pop {
  position: fixed;
  z-index: 1000;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-pop);
  overflow: hidden;
  padding: 4px;
}
</style>
