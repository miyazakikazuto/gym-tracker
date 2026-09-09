import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { getBase } from './src/lib/base.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages: situs di sub-path /gym-tracker/. Vercel: di root.
  // Vercel menyetel env VERCEL=1 saat build, jadi base otomatis menyesuaikan.
  // Single source: src/lib/base.ts — ubah di sana, jangan duplikat string di sini.
  base: getBase(),
  build: {
    // Kompatibilitas lebih luas: browser/webview HP lama (Android 7+, iOS 13+)
    target: ['es2019', 'safari13', 'chrome73', 'firefox66'],
    // SDK Firestore (~520 kB, gzip ~150 kB) dipisah ke chunk sendiri:
    // isinya jarang berubah antar rilis, jadi hash-nya stabil — returning user
    // tidak perlu download ulang saat kode app berubah. Tetap lazy-loaded
    // (hanya diunduh setelah login, bersama DataContext).
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            {
              name: 'firebase-firestore',
              test: /[\\/]@?firebase[\\/](firestore|logger)[\\/]/,
            },
          ],
        },
      },
    },
  },
})