import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/styles/main.css'
import App from './App.vue'
import router from './router'
import { setTokenProvider } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import { reportUnhandledError } from '@/utils/reportUnhandledError'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

setTokenProvider(() => useAuthStore().token)

// Safety net for errors that escape a component's own try/catch — without this the user gets
// a blank screen or a stuck spinner with no feedback while the real error only shows in devtools.
app.config.errorHandler = (err) => reportUnhandledError(err, 'vue')
window.addEventListener('unhandledrejection', (event) => reportUnhandledError(event.reason, 'promise'))

app.mount('#app')
