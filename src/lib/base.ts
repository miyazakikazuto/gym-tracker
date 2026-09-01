// Base path — single source of truth, dipakai vite.config.ts & scripts/gen-sw.cjs
// Vercel: root '/', GitHub Pages: '/gym-tracker/'
// Dipakai di vite.config.ts (Node, build-time) — guard typeof process agar aman jika ter-bundle ke browser
export function getBase(): string {
  return typeof process !== 'undefined' && (process as unknown as { env: Record<string, string | undefined> }).env.VERCEL
    ? '/'
    : '/gym-tracker/'
}
