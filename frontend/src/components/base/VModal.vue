<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount, useId } from 'vue'
import VIcon from './VIcon.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    subtitle?: string
    tone?: 'info' | 'warning' | 'danger' | 'success'
    error?: string
  }>(),
  { tone: 'info' },
)

const emit = defineEmits<{
  close: []
}>()

const TONE_ICON: Record<string, string> = {
  info: 'info',
  warning: 'alert-triangle',
  danger: 'alert-circle',
  success: 'check-circle-2',
}

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

  const focusable = Array.from(dialogRef.value.querySelectorAll<HTMLElement>(FOCUSABLE))
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
    <div v-if="open" class="modal-scrim" role="presentation" @click="$emit('close')">
      <div
        ref="dialogRef"
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @click.stop
      >
        <div class="modal-head">
          <VIcon :name="TONE_ICON[tone] ?? 'info'" :size="22" class="modal-ic" :class="`modal-ic--${tone}`" />
          <div>
            <h2 :id="titleId" class="modal-title">{{ title }}</h2>
            <p v-if="subtitle" class="modal-sub">{{ subtitle }}</p>
          </div>
        </div>
        <div v-if="error" class="modal-error" role="alert">
          <VIcon name="alert-circle" :size="15" style="flex-shrink: 0" />
          {{ error }}
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-foot">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-ic--info {
  color: var(--navy);
}
.modal-ic--warning {
  color: var(--warning);
}
.modal-ic--danger {
  color: var(--danger);
}
.modal-ic--success {
  color: var(--success);
}
</style>
