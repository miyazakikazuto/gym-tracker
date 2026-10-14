---
name: gym-tracker
description: Use when working on the Gym Tracker PWA (React 19 + Vite + TS + Firebase) — workout logging, 5/3/1 progression, rotation, rest/cardio sessions, Vercel + GitHub Pages deploys. Covers domain logic in src/lib (tests required), Firestore schema, and hard-won incident lessons.
---

# Gym Tracker — PWA pelacak latihan pribadi

SPA Bahasa Indonesia. Repo `miyazakikazuto/gym-tracker`, Vercel prod + GH Pages.

## Stack & structure

React 19 + Vite 8 + TypeScript. `HashRouter` (tanpa SPA rewrite).
Firebase Auth (Google + Email/Password) + Firestore project **`gym-tracker-db-53d67`**.
Data: `users/{uid}/{sessions, exercises, bodyweight, profile, settings}` — UID awet hasil `auth:import`.

```
src/lib/          Domain logic MURNI (progression.ts 5/3/1, rotation.ts, e1rm.ts,
                  templates.ts, helpers.ts, periodSummary.ts) — WAJIB ada test
src/lib/firebase.ts  Config hardcoded, PUBLIK by design (bukan secret)
src/lib/db.ts        initializeFirestore + persistentLocalCache multi-tab
src/lib/gsi.ts       GOOGLE_CLIENT_ID hardcode — ikut pindah tiap ganti project!
src/pages/         Today.tsx, Session.tsx, History.tsx, Progress.tsx
firestore.rules    Source of truth (path dibagi app XAUUSD — jangan bentrok)
```

## Dev commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | vitest run (266 tests domain logic) |
| `npm run lint` | oxlint (0 errors; warning fast-refresh lama abaikan) |
| `npm run build` | `tsc -b && vite build` + postbuild SW (precache 33/33) |

## Deploy dual-platform

| Branch | Target | URL |
|---|---|---|
| `freebuff` | Vercel production (auto tiap push) | `https://gym-tracker-inky-rho.vercel.app` |
| `main` | GitHub Pages | `https://miyazakikazuto.github.io/gym-tracker/` |

Alur: uji di `freebuff` → mantap → `merge --no-ff` ke `main`. Push via SSH
(`git@github.com:miyazakikazuto/gym-tracker.git`) — token HTTPS mati.
Base path adaptif (`VERCEL ? '/' : '/gym-tracker/'`) di **dua tempat**:
`vite.config.ts` dan `scripts/gen-sw.cjs` — ubah keduanya bersamaan.

## Guardrails

- Keamanan = `firestore.rules` (`uid == userId`), bukan config rahasia.
- Jangan ganti `db.ts` balik ke `getFirestore` biasa (offline persistence).
- Rest Day = tampilan istirahat (tanpa gerakan/RPE/stiker); deteksi pakai
  `isRestLoose()` (tahan stiker), normalisasi via `normalizeRestSession()`.
- `const` yang dipakai `del()`/branch lain HARUS di atas semua early-return
  (TDZ Regards: insiden `sid` 14 Okt 2026).
- Toast error tulis HARUS bawa kode asli (`errCode(e)`), jangan generik.
- Verifikasi di HP: **tutup total tab** (PWA nahan build lama, reload tak cukup).

## Insiden tercatat (jangan ulangi)

1. **Pindah Firebase project** (14 Okt 2026): `auth:export/import` (UID awet) +
   script Admin SDK copy `users/{uid}/**` + verifikasi hitungan per koleksi.
   Checklist project baru: Firestore Native, Auth Email/Password + Google,
   OAuth consent (External + Test users), Web client origins di Cloud Console,
   Authorized domains Firebase. `GOOGLE_CLIENT_ID` di `gsi.ts` penyebab
   `origin_mismatch` — bukan console.
2. **Rest Berlangsung** (13–14 Okt 2026): History bikin rest aktif + Session
   tempel stiker retroaktif + `isRest` exact-match gagal → `isRestLoose`,
   rest selalu langsung selesai, tampilan kartu 😴 + hapus saja.
3. **Hapus rest melempar TDZ**: lihat Guardrails soal early-return.
