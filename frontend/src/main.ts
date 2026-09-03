import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/styles/main.css'
import App from './App.vue'
import router from './router'
import { setTokenProvider } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import { reportUnhandledError } from '@/utils/reportUnhandledError'
import { handleSessionExpired } from '@/utils/handleSessionExpired'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

setTokenProvider(() => useAuthStore().token)

// Safety net for errors that escape a component's own try/catch — without this the user gets
// a blank screen or a stuck spinner with no feedback while the real error only shows in devtools.
app.config.errorHandler = (err) => reportUnhandledError(err, 'vue')
window.addEventListener('unhandledrejection', (event) => reportUnhandledError(event.reason, 'promise'))

// http.ts dispatches this when a token refresh fails (the refresh token is gone, not just the
// access token) — the auth store's own listener on the same event clears the stale session; this
// gives the admin a specific reason and a way back to login, instead of a stuck "Try again" that
// would just repeat the same failed refresh forever.
window.addEventListener('auth:session-expired', handleSessionExpired)

app.mount('#app')
