import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../knife-roll_backend/dist/public' },
  server: {
    proxy: {
      '/api/': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})