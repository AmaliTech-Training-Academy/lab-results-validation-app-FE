import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './assets/styles/main.css'
import App from './App.vue'
import router from './router'
import { setTokenProvider } from '@/services/http'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

setTokenProvider(() => useAuthStore().token)

app.mount('#app')
