import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // SSE streaming endpoint — needs buffering disabled
      '/api/groups': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Disable response buffering so SSE events flow through immediately
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Force streaming by preventing http-proxy from buffering
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache'
            }
          })
        },
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
