# Gym Tracker

Aplikasi tracking jadwal & log latihan gym — pribadi, multi-perangkat (HP + PC).

- **Frontend**: React + Vite + TypeScript (SPA, GitHub Pages)
- **Backend**: Firebase project `xauusd-jurnal` (Auth email + Firestore, path `users/{uid}/gym/**`)
- **Tanpa login multi-user** — satu akun email untuk semua perangkat. Data terisolasi dari app XAUUSD di project yang sama.

## Fitur

- Jadwal latihan mingguan (split per hari: Push/Pull/Legs, dll)
- Log sesi: isi beban & rep per set, catatan
- Riwayat kalender + detail sesi
- Progress: volume per minggu, PR (beban tertinggi) per gerakan
- Library gerakan (CRUD): grup otot + alat

## Dev

```bash
npm install
npm run dev      # dev server
npm run build    # produksi -> dist/
```

Firebase config hardcoded di `src/lib/firebase.ts` (config publik, bukan secret).

## Deploy

Push ke `main` memicu GitHub Actions → build → publish ke GitHub Pages. Pastikan **Settings → Pages → Source = "GitHub Actions"**.

URL: `https://miyazakikazuto.github.io/gym-tracker/`

### Vercel (tempat uji coba branch)

Project Vercel: `gym-tracker` (akun miyazakikazuto). Hanya dipakai untuk uji coba — branch selain `main` (mis. `freebuff`) otomatis di-deploy ke URL preview Vercel setiap push.

- **`main`** → tidak di-deploy ke Vercel (`ignoreCommand` di `vercel.json` me-skip build, exit 0 = skip)
- **branch lain** (mis. `freebuff`) → deploy preview otomatis, URL: `https://gym-tracker-git-<branch>-<team>.vercel.app` (cek di dashboard Vercel)

Base path otomatis menyesuaikan platform: `/gym-tracker/` di GitHub Pages, `/` di Vercel (via env `VERCEL=1` saat build).

Alur kerja: kerja & push di `freebuff` untuk uji fitur baru tanpa menyentuh website utama; setelah mantap, merge ke `main`.

## Firestore Rules

Rules source of truth: `firestore.rules` (di repo ini).

Path `users/{uid}/...` digunakan bersama project `xauusd-jurnal` (app XAUUSD). Pastikan rules tidak saling bentrok.

### Verifikasi rules lama
1. Buka Firebase Console → project `xauusd-jurnal` → Firestore → Rules
2. Pastikan ada `match /users/{uid}/{document=**}` dengan rule `allow read, write: if request.auth.uid == uid`
3. Jika rules kosong/longgar → deploy rules baru (lihat di bawah)

### Deploy
- **Via CLI:** `npx firebase-tools deploy --only firestore:rules` (butuh login `npx firebase-tools login` terlebih dulu)
- **Manual:** salin isi `firestore.rules` → paste di Firebase Console → Firestore → Rules → Publish

> **Status saat ini:** Rules di console sudah benar — `users/{userId}/{document=**}` dengan `request.auth.uid == userId`. File ini di-sync sebagai source of truth.