import { useToastStore } from '@/stores/toast'

const CHUNK_LOAD_PATTERN = /loading (chunk|css chunk)|failed to fetch dynamically imported module|error loading dynamically imported module/i

let lastMessage = ''
let lastShownAt = 0

/**
 * Last-resort UI feedback for errors that slip past a component's own try/catch — a stray
 * promise rejection, a render-time throw, a stale-deploy chunk failure. Wired up in main.ts
 * (app.config.errorHandler, window "unhandledrejection") and router/index.ts (router.onError).
 * Without this the user sees a blank screen or a frozen button while the console fills up.
 */
export function reportUnhandledError(error: unknown, context: string): void {
  console.error(`[unhandled:${context}]`, error)

  const message = error instanceof Error ? error.message : String(error)

  // Benign browser noise (a well-known Chrome/Safari quirk) — not worth alarming the user over.
  if (/ResizeObserver loop/i.test(message)) return

  // Collapse bursts of the same error (e.g. a flaky stream retrying repeatedly) into one toast.
  const now = Date.now()
  if (message === lastMessage && now - lastShownAt < 4000) return
  lastMessage = message
  lastShownAt = now

  const toast = useToastStore()

  // A new deploy invalidated the JS chunks this tab already has loaded — dismissing won't help,
  // the user needs a fresh page load to pick up the new build.
  if (CHUNK_LOAD_PATTERN.test(message)) {
    toast.show(
      {
        tone: 'danger',
        title: 'App update available',
        body: 'This page is out of date. Reload to get the latest version.',
        action: { label: 'Reload now', onClick: () => window.location.reload() },
      },
      0,
    )
    return
  }

  // `message` is already the backend's own explanation when there is one — `http.ts`'s
  // `parseHttpError` pulls it out of the JSON error body before this ever gets thrown. Only fall
  // back to a generic line when there's nothing useful to show (a non-Error throw, or a blank message).
  const hasRealMessage = error instanceof Error && message.trim().length > 0
  toast.show({
    tone: 'danger',
    title: 'Something went wrong',
    body: hasRealMessage ? message : 'An unexpected error occurred. Please try again, and contact support if it keeps happening.',
  })
}
