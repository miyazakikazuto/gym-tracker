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

Project Vercel: `gym-tracker` (akun miyazakikazuto, team `miyazakikazutos-projects`). Hanya dipakai untuk uji coba.

- **Production branch Vercel = `freebuff`** → setiap push ke `freebuff` otomatis jadi Production deployment.
- **URL tetap (selalu code terbaru): `https://gym-tracker-inky-rho.vercel.app`** — bookmark URL ini, jangan pakai URL deployment (immutable per deploy).
- **`main`** → production asli tetap GitHub Pages; di Vercel hanya menghasilkan preview deployment (`vercel.json` tidak lagi punya `ignoreCommand`, jadi semua branch dapat preview).
- URL preview per deploy (berubah-ubah, hanya untuk debug): `https://gym-tracker-<hash>-<team>.vercel.app`

### Deploy via Vercel CLI

```bash
npm i -g vercel        # sekali saja
cd gym-tracker
vercel deploy          # preview deployment
vercel deploy --prod   # production -> URL tetap langsung update
```

Auth: `vercel login` interaktif, atau pakai token dari [vercel.com/account/tokens](https://vercel.com/account/tokens):

```bash
export VERCEL_TOKEN=<token>
vercel deploy --prod --token="$VERCEL_TOKEN"
```

Base path otomatis menyesuaikan platform: `/gym-tracker/` di GitHub Pages, `/` di Vercel (via env `VERCEL=1` saat build).

Alur kerja: kerja & push di `freebuff` untuk uji fitur baru (URL tetap langsung update); setelah mantap, merge ke `main` untuk GitHub Pages.

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