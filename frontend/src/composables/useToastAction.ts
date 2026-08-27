import { useToastStore, type ToastPayload } from '@/stores/toast'
import { toErrorMessage } from '@/utils/errors'

/** Runs an async action and surfaces a toast for the outcome — collapses the repeated try/catch-toast pattern. */
export function useToastAction() {
  const toast = useToastStore()

  async function run(action: () => Promise<void>, opts: { success?: ToastPayload; error: ToastPayload }) {
    try {
      await action()
      if (opts.success) toast.show(opts.success)
    } catch (e) {
      // A caller-supplied `body` is a deliberate, specific message (e.g. a "cohort locked" special
      // case) and wins outright; otherwise show the backend's real explanation instead of going
      // silent on it — only a non-Error throw (nothing useful to show) falls back to a title-only toast.
      const body = opts.error.body ?? (e instanceof Error ? toErrorMessage(e, e.message) : undefined)
      toast.show({ ...opts.error, body })
    }
  }

  return { run }
}
