import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  // Dev-only: forward /api calls to the backend on localhost:8080.
  // The browser calls a relative "/api/..."; Vite proxies it (no CORS, no
  // hard-coded host). Backend serves under /api, so the path is forwarded
  // unchanged. cookieDomainRewrite makes the backend's Set-Cookie usable on
  // localhost (needed for cookie/session-based auth).
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
})
