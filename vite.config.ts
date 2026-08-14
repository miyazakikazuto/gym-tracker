import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages: situs di sub-path /gym-tracker/. Vercel: di root.
  // Vercel menyetel env VERCEL=1 saat build, jadi base otomatis menyesuaikan.
  base: process.env.VERCEL ? '/' : '/gym-tracker/',
  build: {
    // Kompatibilitas lebih luas: browser/webview HP lama (Android 7+, iOS 13+)
    target: ['es2019', 'safari13', 'chrome73', 'firefox66'],
  },
})