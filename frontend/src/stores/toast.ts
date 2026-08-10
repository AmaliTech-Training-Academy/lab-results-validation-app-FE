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

export const useToastStore = defineStore('toast', () => {
  const toast = ref<ToastPayload | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  /** Pass duration <= 0 to keep the toast visible until the user dismisses it (e.g. a critical action prompt). */
  function show(payload: ToastPayload, duration = 5000) {
    if (timer) clearTimeout(timer)
    toast.value = payload
    timer = duration > 0 ? setTimeout(() => { toast.value = null }, duration) : null
  }

  function dismiss() {
    if (timer) clearTimeout(timer)
    toast.value = null
  }

  return { toast, show, dismiss }
})
