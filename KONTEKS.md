# KONTEKS — Gym Tracker (Ringkasan Session untuk New Session)

> File ini buat pindah session tanpa kehilangan konteks.
> Cara pakai: buka session baru → minta AI `read KONTEKS.md` → lanjut dari "Next Move".
> Update file ini setiap selesai langkah besar.

---

## 1. Objective

- Perbaiki & kembangkan `gym-tracker/` (React 19 + Vite 8 + TS + Firebase `xauusd-jurnal`) agar sinkron `freebuff` (Vercel prod) ↔ `main` (GH Pages), hilangkan bug volume/Progress/offline/cycle 5/3/1, lalu bikin rekap & stiker retroaktif jujur.
- Bahasa UI Indonesia. Gaya bicara ke user: **bahasa bayi** 👶.

## 2. Important Details

- **Repo:** `miyazakikazuto/gym-tracker` — root `ironfit-gym` (tiga project: Gym root, Gym Tracker, Meridian). `gym-tracker/` adalah SPA.
- **Branch & Deploy:**
  - `freebuff` = Production Vercel → `https://gym-tracker-inky-rho.vercel.app` (`prj_58X3qKwhPGEfWfwtgbgyS1rRBLr6`, team `miyazakikazutos-projects`)
  - `main` = GitHub Pages → `https://miyazakikazuto.github.io/gym-tracker/`
  - Alur: `freebuff` uji → `merge --no-edit` → `main`. `vercel deploy --prod` manual. `vercel.json` kosong (tanpa `ignoreCommand`, semua branch preview). `vite.config.ts:9` & `scripts/gen-sw.cjs:11` base adaptif `VERCEL ? '/' : '/gym-tracker/'` — **ubah keduanya bersamaan**.
- **Firebase:** `src/lib/firebase.ts` config hardcoded publik by design, `projectId: xauusd-jurnal`, path `users/{uid}/gym/**` (shared dengan app XAUUSD — jangan bentrok `firestore.rules:4` `users/{userId}/{document=**}`). Offline persistence `src/lib/db.ts:21` `initializeFirestore(persistentLocalCache(multiTab))` — **jangan balik ke `getFirestore`**.
- **Token:** `VERCEL_TOKEN=vcp_6mp...jAaiTh0nBFD1` (user bilang `biarin` tidak revoke), CLI `vercel@59.5.0`, `.vercel/project.json` sudah link.
- **Stack & Build:** `HashRouter` (tanpa SPA rewrite), `tsc -b && vite build` + `postbuild node scripts/gen-sw.cjs` (precache 29/29 ~1037KB), `rolldownOptions advancedChunks firebase-firestore`, `chunkSizeWarningLimit:600`, `vitest run` **76 tests**, `oxlint` 0 errors, CI `.github/workflows/test.yml` Node 24 vs `deploy.yml` Node 20 (drift, belum disamakan).
- **Domain Logic:** `src/lib/progression.ts` (5/3/1 cycle 16 sesi / 12 sesi jika `excludeEasyDay`), `rotation.ts`, `e1rm.ts` — wajib ada test. `types.ts:53` `Session.cycle/cycleLabel/scheme/isExtra`, `UserSettings.cycleNumber/sessionIndex` legacy mati (tidak dibaca `computePosition`), `skippedSessions` yang dipakai.
- **Preferensi User:** Merge tiap fitur `checkout main && pull && merge --no-edit && npm test && push`, dropdown rekap mingguan/bulanan, `isExtra` manual smart default, `fmtNumber` koma, WIB `todayKey/parseKey/addDays/weekStart`, review Langkah 1 dulu baru Langkah 2.

## 3. Work State

### Completed (kronologis)

- Vercel link + deploy prod/preview OK, README/AGENTS/gh `ignoreCommand` fix.
- Offline persistence + `DataContext` migrasi kategori + `cycleLabel` mismatch.
- Progress volume: `otherVol` + footer jujur + `(Lainnya)` Cardio/hapus, cap 5j, `otherVol` detail.
- Build: `advancedChunks` + `vercel.json immutable /assets/*` + `gen-sw.cjs` precache all.
- Fitur: `tmSuggestion` + `exerciseSuggestion` + `periodSummary`/`sessionSummary` rekap AI mingguan/bulanan dropdown 52 minggu + `Session/SessionRow/Today/History` stiker `[C1-S03] Leg — 3×5` ngikut `plan.name`.
- **Fix rekap retroaktif** `a811954`: `periodSummary.ts:140` Daftar sesi fallback `computePosition` bila `!cycleLabel && !isExtra` + `Progress.tsx:21` kirim `settings` → `23–29 Agu` polos → berisi. Verified `udah ada masuk`.
- **Fix Rest 29 Agu crash** `2e00bf4`: `gymstore.ts:170` filter `scheme undefined` + `History.tsx:117` `isRest` bypass tanpa snapshot + `Today.tsx:220` wave guard → `addDoc Unsupported field value: undefined (field scheme)` hilang, Rest tidak majuin `leg/push/pull`.
- **Fix Langkah 1** `6ecacca` (freebuff) / `c70021a` (main) — TERBARU:
  - `progression.ts:156` `getScheme` → `index % dynamicCycleLength` bukan `schemes.size` (Easy W4 tidak lagi salah `3×3`)
  - `progression.ts:178` `getSbdLiftForSession` → `undefined` jika `types[idx]==='easy'` (Easy tanpa TM)
  - `History.tsx:119` `handleCreate` → `parseKey(selKey)+12h` bukan `Date.now()` (sorting & `computePosition` jujur)
  - `DataContext.tsx:131` migrasi cycle → guard `ready`, exact match `labelPlan !== planName`, `cycleMigratedRef` sekali, `writeBatch`, nested dynamic import.

### Active

- Review Langkah 1 di HP: `Riwayat → + Easy Day` polos tanpa `3×3`, `+ Rest Day 29 Agu` merah REST tidak geser `C/S`, `Today` badge `S1..S12` benar. Menunggu konfirmasi user sebelum Langkah 2.

### Blocked

- (tidak ada — plan mode sudah dibuka `eksekusi`)

## 4. Next Move

1. **Verifikasi Langkah 1 manual HP** → `npm test` 76 pass, `npm run build` 29/29 sudah hijau di `6ecacca`.
2. **Langkah 2 (perf/duplikasi):**
   - `Session.tsx:549,569,574` `suggestExercises` dipanggil 3× per render → `useMemo` sekali
   - `paceStr` duplikat `Session.tsx:800` vs `Progress.tsx:734` → ekstrak `src/lib/cardio.ts` (`isCardioExercise` + `fmtPace`)
   - `Progress.tsx:42,75` loop volume tanpa `useMemo` → helper `aggregateMuscleVolume`
3. **Langkah 3 (dead code & drift):**
   - Hapus `gymstore.ts:81,191` `patchExerciseCategory`/`makeSessionSet` (0 pemakai)
   - Betulkan `Settings.tsx:554` Reset cycle (`cycleNumber/sessionIndex` mati → ganti jadi `skippedSessions`-based, tanya user dulu: balik C1-S01 beneran atau cuma nol-in skip)
   - Samakan Node CI `test.yml:15` 24 vs `deploy.yml:23` 20
4. Tiap langkah: `npm test && npm run lint && npm run build` → `push freebuff` → `merge main --no-edit` → cek 2 URL.

## 5. Relevant Files

| File | Konten penting |
|---|---|
| `src/lib/progression.ts:156,178` | `getScheme`/`getSbdLiftForSession` + `computePosition`/`computeExcludedTypes`/`dynamicCycleLength` |
| `src/pages/History.tsx:111` | `handleCreate` (Rest bypass + `parseKey` + `isExtra`) |
| `src/context/DataContext.tsx:131` | migrasi cycle (guard + batch) |
| `src/lib/gymstore.ts:154,170` | `buildSession` (scheme guard) + `importBackup`/`patchExerciseCategories` |
| `src/lib/periodSummary.ts:140` | Daftar sesi fallback retroaktif (butuh `settings`) |
| `src/pages/Progress.tsx:21,32,734` | `settings`→`formatPeriodForAI` + `paceStr` duplikat |
| `src/pages/Session.tsx:332,549,800` | `isCardio` lokal / `suggestExercises` 3× / `paceStr` |
| `src/pages/Today.tsx:202,212` | `createAndOpen` stiker + `templatePlan` serial `createExercise` |
| `src/types.ts:53,87` | `Session` cycle fields + `UserSettings` legacy |
| `src/lib/sessionSummary.ts:8` | `isCardioExercise` shared |
| `vite.config.ts:9` + `scripts/gen-sw.cjs:11` | base sync (ubah bersamaan) |
| `vercel.json:3` | headers immutable `/assets/*` |
| `firestore.rules:4` | auth-gated user-isolated |
| `.github/workflows/test.yml:15` | Node 24 (drift vs deploy 20) |

## 6. Workflow Ringkas

```
Ide/Bug → Plan (read-only) → Review (user "ok gas") → /build →
Edit 2-3 file → npm test 76 + build 29/29 →
commit freebuff → Vercel prod auto →
merge main --no-edit → GH Pages → cek HP
```

## 7. Open Issues (sisa audit, belum dieksekusi)

- **Kritis:** C1–C3 sudah dibenerin (`6ecacca`). Sisa: `Session.tsx:56` `useEffect([id,ready])` missing `session` dep (stale `localSets`), `gymstore.ts:229` `importBackup` non-atomic 400 chunk, `Library.tsx:42` `mergeDuplicates` serial tanpa batch.
- **Sedang:** `suggestExercises` 3×, `Progress` unmemoized, `paceStr`/`isCardio` duplikat, `Today.tsx:179` `templatePlan` 6× serial `await`, `helpers.ts:44` `bestSetResult` cardio metric, `Weight.tsx:148` `replace` bukan `replaceAll`.
- **Rendah:** Dead exports (`makeSessionSet`, `patchExerciseCategory`), Reset cycle bohong (`Settings.tsx:554`), Node drift CI, `gen-sw.cjs:15` scan tidak rekursif.
- **GitHub Issues:** #2 pagination sessions & #3 sinkron `firestore.rules` vs Console masih open.

## 8. Status Terakhir

- `freebuff` = `main` = **`4212e81`** (merge 09 Sep 2026 — sinkron penuh, P1 + rehab + cardio + fix tanggal semua di dua-duanya).
- PWA `sw.js` precache **33/33** (~1055 KB, filter .map).
- Test **232 pass (17 file)**, lint 0 error (warning fast-refresh saja), typecheck 0.
- **Mode Rehab FINAL (committed):** `rehabMode` di settings, cycle **16 sesi** `[leg-iso, leg-light, upper-r, cardio]×4` + wave W1 3×30s → W2 3×35s → W3 3×40s → W4 deload 2×30s, stiker `[R1-S01] .. — Wx`, deteksi iso gabungan `hasIsoSet` (leg day isi hold ikut kehitung), grid 16 kotak di beranda (hanya ronde berjalan), hitung sesi rehab saja, tombol tambah Riwayat disaring, mode Mingguan dihapus (Rotasi+Rehab saja). Lutut 60° + stop-rule nyeri/panas >5/10, Leg Curl tetap.
- **Cardio FINAL (committed):** card Cardio terpisah di Progress + total mingguan vs target fix **15–25 km/minggu** (minggu berjalan, bukan rata-rata 4 minggu), `Jalan Kaki` di library + sinkron preset ke akun lama (`syncPresetExercises`), status 1 baris, `DecimalInput` (koma aman, style prop), quick-log jalan gabung ke sesi cardio hari itu (cari sesi cardio tanggal tsb → tambah set, else bikin `Cardio Day`).
- **Kondisi user:** tangan kiri cedera grip (grip off) + lutut kanan patellar fase isometrik. Gaya bicara: santai "bre".
- ⚠️ **Token terekspos di chat, WAJIB revoke + JANGAN tulis full di repo:** `VERCEL_TOKEN` (prefix `vcp_6mp…`, full ada di chat session 09 Sep 2026) + `GH_TOKEN` (prefix `ghp_e7P…`, full ada di chat). Revoke di Vercel dashboard + GitHub settings, lalu generate baru.

### Komit `freebuff` setelah `ba74944` (kronologis, semua pushed → Vercel prod)

1. `bbbe4d5` Mode Rehab 8 sesi awal → `d984089` 16 sesi + waves → `a194306` grid 16 kotak → `a5f9138` hitung rehab-only + grid ronde berjalan → `1a97837` `hasIsoSet` → `1940699` saring Riwayat → `22ed704` easy→cardio → `6b5e937` pool rehab + form cerdas + input detik → `25b6a67` hapus Mingguan.
2. `b0b4edf` rekap cap 300 mnt + iso tanpa e1RM → `21c9f5e` total hold → `0193129` badge e1RM hidden durasi → `97a2fcb` hapus Jarak iso → `4e4d539` input durasi 46px.
3. `b589257` saran tidak dobel + Jalan Kaki → `ff71733` `syncPresetExercises` → `bdc5876` `fmtInput` anti-bulat → `59aa291` card Cardio → `16acf58` total mingguan → `bbd070b` label 1 baris → `bc1725d` `DecimalInput` → `06b1dc7` quick-log gabung.
4. `546471f` (TERBARU) quick-log tanggal teks `HH/BB/TTTT` + `[Hari ini] [Kemarin]`: popup `input type=date` macet di desktop user (jalan di HP) → teks + `parseDMY`/`formatDMYInput` di `date.ts` (validasi kabisat/bulan/tahun, tolak masa depan), test `date.test.ts` 4 case.

## 9. Next Move (update 09 Sep 2026, post-merge)

1. **Cek 2 URL:** Vercel prod `https://gym-tracker-inky-rho.vercel.app` + GH Pages `https://miyazakikazuto.github.io/gym-tracker/` (tunggu deploy Pages selesai).
2. **Revoke token terekspos** (Vercel dashboard + GitHub settings) lalu generate baru — full token hanya ada di chat session 09 Sep 2026, jangan tulis di repo (push protection nolak).
3. Lanjut issue kecil bila ada (contoh: card volume `(Lainnya)` bila gerakan dihapus dari Library).
4. Tiap langkah: `npm test && npm run lint && npm run build` → `push freebuff` → `merge main` → cek HP + desktop.
