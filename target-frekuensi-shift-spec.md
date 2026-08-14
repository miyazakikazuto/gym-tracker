# Spec: Target Frekuensi & Shift Kerja

> Status: **draf spec** — hasil wawancara dengan user (4 putaran) + data pola siklus shift. Belum ada perubahan kode.
> Tujuan spec: menjelaskan makna & perilaku yang diinginkan dari dua konsep ini, fokus utama **Target frekuensi** (paling membingungkan), yang pertama kali dilihat user di **halaman Pengaturan**.

---

## 1. Konteks & latar belakang

- Fitur "Mode Rotasi" (live sejak commit `28484cf`) memperkenalkan 2 pengaturan baru di Pengaturan: **Target frekuensi** dan **Shift kerja**.
- User bertanya "jelaskan maksud dari target frekuensi dan shift kerja" → istilah di UI tidak cukup jelas.
- User bekerja **3 shift (pagi/siang/malam)** yang berubah-ubah — ini konteks utama mengapa kedua fitur ini dibuat.

### Kondisi implementasi saat ini (untuk referensi)

| Fitur | Implementasi sekarang |
|---|---|
| Target frekuensi | `weeklyTarget` (2–7, default **4**). Ditampilkan sebagai stat **"Sesi · 7 hari"** (`x / target`) di halaman Hari Ini. Hitungan = **sesi selesai** dalam 7 hari berjalan (`freq7` di `src/lib/rotation.ts`). Murni informatif, tanpa feedback. |
| Shift kerja | `shift` = `'pagi' \| 'siang' \| 'malam' \| null` (opsional). Efek satu-satunya: saat **malam** → saran otomatis jadi **Easy** (`suggestKey`). Tampil sebagai badge "shift: malam" + stat "Shift malam / Recovery ok" di Hari Ini. |

---

## 2. Konsep: Target Frekuensi

### 2.1 Makna yang diinginkan user
> "dalam seminggu contoh sesi leg day 2x atau etc"

Pemahaman user: target frekuensi = **seberapa sering tiap jenis latihan dilakukan per minggu** (mis. **Leg 2×/minggu**), bukan sekadar total sesi.

**Gap penting:** app sekarang menghitung **total sesi** per 7 hari; user memikirkan **frekuensi per kategori** (Leg/Push/Pull/Easy). Spec mengikuti pemahaman user.

### 2.2 Keputusan yang disepakati

| # | Keputusan | Detail |
|---|---|---|
| K1 | **Tampilkan per kategori** | App menampilkan rincian frekuensi per jenis (mis. `LEG 2×`, `PUSH 1×`, `PULL 1×` minggu ini), bukan hanya angka total. |
| K2 | **Easy dikecualikan** | Sesi Easy (latihan ringan) **tidak dihitung** ke frekuensi — hanya Leg/Push/Pull (latihan "sungguhan") yang dihitung. |
| K3 | **Sesi berjalan ikut dihitung** | Sesi yang belum ditandai "Selesai" (mis. user lupa) **tetap dihitung**, supaya angka tidak mengecil karena kelalaian. (Perubahan dari perilaku sekarang yang hanya menghitung `endedAt != null`.) |
| K4 | **Jendela 7 hari berjalan (rolling)** | Rekomendasi saya, user menyerahkan keputusan ("berikan saran"): jendela **7 hari terakhir yang bergeser** lebih cocok untuk jadwal shift (tidak terikat hari kalender; shift malam tidak membuat satu minggu kalender kosong). |
| K5 | **Tetap informatif** | Tanpa peringatan/warna saat ketinggalan target — angka saja, user menilai sendiri. |
| K6 | **Blok malam: target macet itu wajar** | Karena Easy dikecualikan (K2), selama blok shift malam (saran dipaksa Easy) angka frekuensi tidak bergerak — **diterima** sebagai realitas shift malam, tidak perlu kompensasi. |

### 2.3 Rumus hitung (target)
```
frekuensi kategori X (7 hari berjalan) = jumlah sesi dengan plan kategori X
  - dalam 7 hari terakhir (termasuk hari ini)
  - dengan syarat: sesi sudah selesai ATAU masih berjalan (K3)
  - kategori Easy/ringan tidak dihitung (K2)
```

### 2.4 Pertanyaan tersisa (belum diputuskan)
- Apakah angka total "Sesi · 7 hari" (`x / target`) dipertahankan **di samping** rincian per kategori, atau diganti penuh oleh rincian per kategori?
- Apakah target tetap 1 angka global (weeklyTarget) yang berlaku untuk semua kategori, atau user ingin target **per kategori** (mis. Leg 2×, Push 1×, Pull 1×) yang bisa diatur sendiri?
- Posisi tampilan rincian per kategori: di kartu saran Hari Ini, di kartu Rotasi, atau keduanya?

---

## 3. Konsep: Shift Kerja

### 3.1 Makna
Shift kerja = jadwal kerja harian user (pagi/siang/malam/libur) yang dipakai app untuk **menyesuaikan saran latihan** — karena shift sangat memengaruhi waktu, energi, dan recovery.

### 3.2 Pola siklus shift (fakta dari user)
User bekerja pola **3 hari kerja → 1 hari libur**, rotasi maju **Sore → Malam → Pagi → ulang** (dari jadwal resmi Agustus 2026 — dikoreksi; sebelumnya keliru dianggap Pagi → Siang → Malam):

| Hari dalam siklus | Shift |
|---|---|
| 1–3 | **Sore** (15:00–23:00) |
| 4 | Libur |
| 5–7 | **Malam** (23:00–07:00) |
| 8 | Libur |
| 9–11 | **Pagi** (07:00–15:00) |
| 12 | Libur |

- Panjang siklus: **12 hari**, berulang terus; urutan **selalu** Sore → Malam → Pagi.
- **Tanggal patokan (anchor): 12 Agustus 2026 = hari ke-1 blok Sore** (dikonfirmasi dari bacaan kalender asli — sebelumnya keliru 15 Ags, fase bergeser 3 hari).
- Rumus hitung otomatis: `pos = (tanggal − anchor) mod 12` → petakan ke tabel di atas.
  - Verifikasi (bacaan yang dikonfirmasi user): **11 Libur · 12–14 Sore · 15 Libur · 16–18 Malam · 19 Libur · 20–22 Pagi · 23 Libur · 24–26 Sore · 27 Libur · 28–30 Malam · 31 Libur** — jadi 14 Ags = Sore, 15 Ags = Libur.
  - Catatan: tanggal di luar blok yang dikonfirmasi (1–10 Ags, dst.) mengikuti siklus yang sama — bisa ditimpa manual per hari bila berbeda dari kenyataan.
- Cara pakai di app: **auto-hitung dari pola** (set pola + tanggal patokan sekali di Pengaturan) **+ override manual per hari** bila ada perubahan mendadak.

### 3.3 Keputusan yang disepakati

| # | Keputusan | Detail |
|---|---|---|
| S1 | **Semua shift berpengaruh** | Bukan hanya malam. Pagi, Siang, dan Malam masing-masing punya efek pada saran (lihat §3.4). |
| S2 | **Auto-hitung dari siklus + override manual** | App menghitung shift hari ini dari pola siklus & tanggal patokan; user bisa menimpa per hari. (Menggantikan rencana awal "tandai manual saja".) |
| S3 | **Sertakan saran waktu latihan** | Selain jenis latihan, app menyarankan **kapan waktu terbaik berlatih** sesuai shift hari itu. |
| S4 | **Alasan perubahan saran harus jelas** | User menjawab "tidak tahu" saat ditanya harapan saat saran berubah → rekomendasi: tampilkan keterangan eksplisit (mis. "disarankan ringan karena shift malam") agar perubahan tidak membingungkan. |
| S5 | **Hari libur tetap dapat saran** | Hari libur = **informasi shift saja**, bukan otomatis istirahat — saran latihan tetap tampil seperti biasa; user bebas latihan atau istirahat. |

### 3.4 Usulan efek per shift (draft untuk di-review — belum final)
Berdasarkan analisa recovery & jadwal shift:

| Shift | Saran jenis latihan | Saran waktu latihan |
|---|---|---|
| Pagi (07–15) | Normal (sesuai rotasi) | Sore setelah kerja (±15–17) |
| Sore (15–23) | Normal (sesuai rotasi) | Pagi sebelum shift (±08–10) — jendela terbaik |
| Malam (23–07) | **Easy** (ringan) | Sebelum shift / setelah bangun tidur — jangan langsung setelah lembur tanpa tidur |
| Libur | Normal (sesuai rotasi) | Bebas — waktu terbaik untuk sesi berat/tambahan |

Aturan emas (opsional, bisa jadi copy di app): *tidur < 6 jam → jangan latihan berat; jadikan hari itu rest aktif.*

### 3.5 Interaksi shift ↔ target frekuensi
- Shift **malam** → saran Easy → sesi Easy **tidak** menambah frekuensi (K2) → angka macet selama blok malam (K6: wajar).
- Saran Easy dari shift malam **tetap bisa ditimpa manual** (pilih plan lain / sesi bebas) — perilaku ini dipertahankan.
- **Hari libur** tidak mengubah saran (S5) — tidak ada relasi khusus dengan target frekuensi.

### 3.6 Pertanyaan tersisa (belum diputuskan)
- Efek konkret shift **Pagi & Siang** selain saran waktu — adakah penyesuaian lain yang diinginkan?
- Tampilan shift di halaman Hari Ini: seberapa besar (badge kecil / stat / kartu)?
- Penyimpanan override manual: per tanggal (riwayat) atau hanya status hari ini?

---

## 4. Ringkasan keputusan (cheat sheet)

**Target frekuensi** = frekuensi latihan **per kategori** per **7 hari berjalan**:
- Rincian per kategori (LEG 2×, PUSH 1×, dst.) — bukan cuma total
- Easy tidak dihitung; sesi berjalan ikut dihitung
- Rolling 7 hari; informatif saja (tanpa peringatan)
- Blok malam membuat angka macet — diterima

**Shift kerja** = penyesuaian saran berdasarkan shift **hari ini**:
- Pola siklus 12 hari: 3× Sore → libur → 3× Malam → libur → 3× Pagi → libur → ulang (anchor: 12 Ags 2026 = hari ke-1 Sore; 14 Ags = Sore, 15 Ags = Libur)
- Auto-hitung dari pola siklus + override manual per hari
- Semua shift berpengaruh; ada saran waktu latihan per shift
- Alasan perubahan saran ditampilkan jelas
- Malam → Easy (ringan); bisa ditimpa manual
- Hari libur = informasi saja, saran tetap tampil

---

## 5. Dampak implementasi (referensi, belum dieksekusi)

| Area | File terlibat | Perubahan potensial |
|---|---|---|
| Data | `src/types.ts` (UserSettings), `src/context/DataContext.tsx` | `shiftCycle` (pola + anchor 12 Ags 2026) + override per tanggal; mungkin target per kategori |
| Logika | `src/lib/rotation.ts` + `src/lib/shift.ts` | `shiftForDate()` dari pola siklus 12 hari; `freq7` → per kategori + sertakan sesi berjalan; efek shift pagi/sore |
| UI Hari Ini | `src/pages/Today.tsx` | Shift hari ini (auto + override); rincian frekuensi per kategori; saran waktu |
| UI Pengaturan | `src/pages/Settings.tsx` | Setup pola siklus + tanggal patokan; penjelasan target frekuensi |
| Copy | teks bantuan di kedua halaman | Penjelasan singkat tiap konsep |

## 6. Langkah berikutnya yang disarankan
1. Putuskan pertanyaan tersisa di §2.4 dan §3.6 (efek konkret tiap shift, target per kategori atau global, tampilan shift di Hari Ini).
2. Review usulan §3.4 (efek shift) — setujui/revisi sebelum implementasi.
3. Implementasi mengikuti keputusan — mulai dari **hitung shift otomatis dari pola siklus** (`shiftFor(date)`), lalu verifikasi build + lint + deploy otomatis ke URL tetap.
