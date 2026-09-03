import router from '@/router'
import { useToastStore } from '@/stores/toast'

/**
 * Wired up in main.ts as the `'auth:session-expired'` listener — http.ts dispatches this exactly
 * once (per dead session, however many concurrent requests failed) after a token refresh attempt
 * itself came back unauthorized, meaning the refresh token is gone too, not just the access token.
 *
 * The auth store's own listener on the same event already clears the stale token/user — that alone
 * left the admin sitting on whatever page they were on, looking at a generic "Could not load X" /
 * "Something went wrong" error with a "Try again" button that just repeats the same failed refresh
 * forever, since the real problem (no valid session) is never fixed by retrying. This moves them to
 * a fresh login instead, with a specific reason and a way back to where they were.
 */
export function handleSessionExpired(): void {
  // Already there (or navigating there) — a stray request left over from elsewhere shouldn't
  // interrupt an in-progress login with a toast about a session that, from here, never existed.
  if (router.currentRoute.value.name === 'login') return

  useToastStore().show({
    tone: 'warning',
    title: 'Session expired',
    body: 'Please log in again to continue.',
  })

  router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
}
