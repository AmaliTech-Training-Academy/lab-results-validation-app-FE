import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastTone = 'success' | 'warning' | 'info' | 'danger'

export interface ToastPayload {
  tone: ToastTone
  title: string
  body?: string
}

export const useToastStore = defineStore('toast', () => {
  const toast = ref<ToastPayload | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  function show(payload: ToastPayload, duration = 5000) {
    if (timer) clearTimeout(timer)
    toast.value = payload
    timer = setTimeout(() => { toast.value = null }, duration)
  }

  function dismiss() {
    if (timer) clearTimeout(timer)
    toast.value = null
  }

  return { toast, show, dismiss }
})
