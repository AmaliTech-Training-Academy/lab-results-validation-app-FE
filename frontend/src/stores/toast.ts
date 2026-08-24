import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastTone = 'success' | 'warning' | 'info' | 'danger'

export interface ToastPayload {
  tone: ToastTone
  title: string
  body?: string
  /** Optional CTA rendered next to the dismiss button (e.g. "Reload" after a stale-deploy chunk error). */
  action?: { label: string; onClick: () => void }
}

export interface ActiveToast extends ToastPayload {
  id: number
}

/** Caps how many toasts stack up at once — a burst (e.g. several SSE failure events in a row) shouldn't paper the screen. */
const MAX_VISIBLE = 3

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ActiveToast[]>([])
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  let nextId = 0

  function clearTimer(id: number) {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
  }

  /** Pass duration <= 0 to keep the toast visible until the user dismisses it (e.g. a critical action prompt). */
  function show(payload: ToastPayload, duration = 5000) {
    const id = ++nextId
    toasts.value.push({ ...payload, id })

    // Stack is full — drop the oldest rather than let the list grow unbounded.
    if (toasts.value.length > MAX_VISIBLE) {
      const dropped = toasts.value.shift()
      if (dropped) clearTimer(dropped.id)
    }

    if (duration > 0) {
      timers.set(id, setTimeout(() => dismiss(id), duration))
    }
    return id
  }

  /** Dismisses one toast by id, or every visible toast when called with no argument. */
  function dismiss(id?: number) {
    if (id === undefined) {
      toasts.value.forEach((t) => clearTimer(t.id))
      toasts.value = []
      return
    }
    clearTimer(id)
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, show, dismiss }
})
