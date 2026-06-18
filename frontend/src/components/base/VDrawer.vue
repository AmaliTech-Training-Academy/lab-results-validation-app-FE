<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount, useId } from 'vue'
import VIcon from './VIcon.vue'

const props = defineProps<{
  open: boolean
  title: string
  subtitle?: string
  error?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const titleId = useId()
let previousFocus: HTMLElement | null = null

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previousFocus = document.activeElement as HTMLElement | null
      await nextTick()
      const first = dialogRef.value?.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
      previousFocus?.focus()
      previousFocus = null
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  previousFocus?.focus()
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key !== 'Tab' || !dialogRef.value) return

  const focusable = Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(FOCUSABLE),
  )
  if (!focusable.length) return

  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="drawer-scrim"
      role="presentation"
      @click="$emit('close')"
    >
      <div
        ref="dialogRef"
        class="drawer"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @click.stop
      >
        <div class="drawer-head">
          <div>
            <h2 :id="titleId" class="drawer-title">{{ title }}</h2>
            <p v-if="subtitle" class="drawer-sub">{{ subtitle }}</p>
          </div>
          <button class="drawer-x" type="button" aria-label="Close" @click="$emit('close')">
            <VIcon name="x" :size="20" />
          </button>
        </div>
        <div class="drawer-body">
          <slot />
        </div>
        <div v-if="error" class="drawer-error" role="alert">
          <VIcon name="alert-circle" :size="15" style="flex-shrink: 0" />
          {{ error }}
        </div>
        <div v-if="$slots.footer" class="drawer-foot">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
