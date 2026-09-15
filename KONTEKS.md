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
- **Stack & Build:** `HashRouter` (tanpa SPA rewrite), `tsc -b && vite build` + `postbuild node scripts/gen-sw.cjs` (precache 33/33 ~1059KB), `rolldownOptions advancedChunks firebase-firestore`, `chunkSizeWarningLimit:600`, `vitest run` **239 tests (17 file)**, `oxlint` 0 errors, CI `.github/workflows/test.yml` Node 24 (deploy.yml Node 20 drift fixed).
- **Domain Logic:** `src/lib/progression.ts` (5/3/1 **dinamis Opsi A**: default 16 `L/P/Pl/E×4` / 12 `L/P/Pl×4` jika `excludeEasyDay`, W4 Deload **di dalam** cycle, `Today.tsx:440` threshold `w=cycleLen/4` biar 12→Deload S10-S12 benar), `rotation.ts`, `e1rm.ts` — wajib ada test. `types.ts:53` `Session.cycle/cycleLabel/scheme/isExtra`, `UserSettings.cycleNumber/sessionIndex` legacy mati (tidak dibaca `computePosition`), `skippedSessions` yang dipakai.
- **Preferensi User:** `freebuff` uji → merge `main --no-edit --no-ff`, `isExtra` Default OFF selalu ( `b6af929` / `0a369e4` ), `fmtNumber` koma, WIB `todayKey/parseKey/addDays/weekStart`, 5/3/1 4 tingkat W1→Deload 4 baris×3 kolom (12) / 4×4 (16) `925d2a6`, siklus dinamis `fa2258d` `w=cycleLen/4`.

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

## 8. Status Terakhir (update 14 Sep 2026)

- `freebuff` **`0a369e4`** (Vercel prod) ahead `main`; `main` terakhir `4212e81` (09 Sep) — belum merge 13 komit baru. PWA `sw.js` precache **33/33** (~1059 KB).
- Test **239 pass (17 file)**, lint 0 error (warning fast-refresh), build OK.
- **Mode Rehab (Opsi A OFF clean):** `rehabMode=true` 16 sesi `W1 Pondasi 30s → W2 35s → W3 40s → W4 Deload 30s ×4`, grid 16 kotak balik `85a1b51` (R-ronde, W1-W4), OFF → `be2c9e2` hide list/kalender + `isCountedSession` exclude `[R]/preset rehab` tidak bocor siklus.
- **Cardio:** 5 kategori `Jalan/Hiking/Running/Treadmill/Lain` `e0e6226`, bulanan byCat `weeksInMonth=ceil(days/7)` + `↑m>0`, all-time dihapus `c8972d9`, quick-log `[km][mnt][dtk]` `381b82b` + tanggal teks `546471f` + prefill cardio fix `ad01437`.
- **5/3/1:** dinamis 12 (Easy OFF `L/P/Pl×4`) / 16 (ON) `fa2258d` `w=cycleLen/4` Deload S10-12/13-16, UI 4 baris×cols `925d2a6` W1 3×5→W4 Deload, Today grid rehab 4 baris. Extra selalu OFF `0a369e4` (Hapus auto `has`).
- **TM keep Opsi A (14 Sep):** `squat 55 / bench 37.5 / deadlift 87.5` keep — tidak turun (sudah ringan), reset W1, monitor `stop >5/10`. Kondisi: tangan kiri grip off, lutut patellar iso 60° 3×30s, leg curl tetap.
- ⚠️ **Token terekspos, WAJIB revoke:** `VERCEL_TOKEN vcp_6mp…` + `GH_TOKEN ghp_e7P…` (full di chat 09 Sep) — revoke & generate baru, push protection aktif.

### Komit `freebuff` setelah `ba74944` (kronologis, semua pushed → Vercel prod)

1. `bbbe4d5` Rehab 8→`d984089` 16 + `a194306` grid → `a5f9138` rehab-only → `1a97837` hasIsoSet → `1940699` filter → `22ed704` easy→cardio → `6b5e937` pool → `25b6a67` hapus Mingguan.
2. `b0b4edf` cap iso → `21c9f5e` total hold → `0193129` badge hidden → `97a2fcb` jarak iso → `4e4d539` durasi 46px.
3. `b589257` tidak dobel + Jalan Kaki → `ff71733` syncPreset → `bdc5876` fmtInput → `59aa291` card Cardio → `16acf58` mingguan 15-25km → `381b82b` mnt+dtk → `ad01437` prefill cardio fix → `e0e6226` 5 kategori bulanan → `c8972d9` hapus all-time.
4. `546471f` tanggal teks `HH/BB/TTTT` + `parseDMY`, `fa2258d` 5/3/1 `w=cycleLen/4`, `925d2a6` 4 baris×3 kolom, `45fd12b` hapus grid rehab → `85a1b51` balikin W1→Deload, `be2c9e2` OFF hide, `b6af929`/`0a369e4` extra selalu OFF ( `isCountedSession` 6 predikat ).

## 9. Next Move

1. **Merge freebuff → main** (13 komit) → cek GH Pages `https://miyazakikazuto.github.io/gym-tracker/` + Vercel prod.
2. **Revoke token** (Vercel + GitHub) — full token di chat, jangan tulis repo.
3. Jalan 1 cycle P1 dari W1 3×5 dengan TM 55/37.5/87.5 keep — evaluasi `>5/10` di W3, baru naik 2.5kg.
