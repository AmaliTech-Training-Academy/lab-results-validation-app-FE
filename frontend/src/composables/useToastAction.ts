import { useToastStore, type ToastPayload } from '@/stores/toast'

/** Runs an async action and surfaces a toast for the outcome — collapses the repeated try/catch-toast pattern. */
export function useToastAction() {
  const toast = useToastStore()

  async function run(action: () => Promise<void>, opts: { success?: ToastPayload; error: ToastPayload }) {
    try {
      await action()
      if (opts.success) toast.show(opts.success)
    } catch {
      toast.show(opts.error)
    }
  }

  return { run }
}
