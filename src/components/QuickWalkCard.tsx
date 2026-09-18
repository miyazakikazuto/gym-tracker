// Quick-log jalan kaki (lapangan/Strava) — catat jarak + durasi tanpa buka halaman sesi.
// Elevasi diisi manual di sesi. Auto-tempel ke sesi hari itu (Leg Day) bila ada,
// kalau hari kosong bikin Cardio Day baru.
import { useState } from 'react'
import { useData } from '../context/DataContext'
import { useUid } from '../context/AuthContext'
import { todayKey, addDays, formatDMYInput, parseDMY, parseKey } from '../lib/date'
import { fmtNumber } from '../lib/helpers'
import { combineMinSec, createSession, updateSession, buildQuickWalkSet, findTodayCardioSession, findWalkExercise } from '../lib/gymstore'
import DecimalInput from './DecimalInput'

export default function QuickWalkCard() {
  const { sessions, exercises, showToast } = useData()
  const uid = useUid()

  const today = todayKey()
  // Tanggal = teks DD/MM/YYYY + tombol cepat (popup date bawaan rewel di desktop)
  const [walkDateText, setWalkDateText] = useState(formatDMYInput(today))
  const [walkDist, setWalkDist] = useState(0)
  const [walkMin, setWalkMin] = useState(0)
  const [walkSec, setWalkSec] = useState(0)
  const [walkBusy, setWalkBusy] = useState(false)
  const [walkFormKey, setWalkFormKey] = useState(0) // remount input = bersihkan draf

  async function saveQuickWalk() {
    const walkDate = parseDMY(walkDateText)
    if (!walkDate) {
      showToast('Tanggal tidak valid (format HH/BB/TTTT)', 'error')
      return
    }
    if (walkDate > today) {
      showToast('Tanggal tidak boleh masa depan', 'error')
      return
    }
    if (!(walkDist > 0)) {
      showToast('Jarak harus lebih dari 0', 'error')
      return
    }
    const durSec = combineMinSec(walkMin, walkSec)
    if (durSec === null) {
      showToast('Durasi tidak valid', 'error')
      return
    }
    const ex = findWalkExercise(exercises)
    if (!ex) {
      showToast('Belum ada gerakan cardio di library', 'error')
      return
    }
    setWalkBusy(true)
    try {
      const target = findTodayCardioSession(sessions, exercises, walkDate)
      if (target) {
        const maxNo = target.sets.reduce((m, s) => Math.max(m, s.setNumber), 0)
        const set = buildQuickWalkSet(ex.id, maxNo + 1, walkDist, durSec)
        if (!set) throw new Error('invalid')
        await updateSession(uid, target.id, { sets: [...target.sets, set] })
      } else {
        const set = buildQuickWalkSet(ex.id, 1, walkDist, durSec)
        if (!set) throw new Error('invalid')
        const base = walkDate === today ? Date.now() - durSec * 1000 : parseKey(walkDate).getTime() + 12 * 3600 * 1000
        await createSession(uid, {
          date: walkDate,
          planId: null,
          planName: 'Cardio Day',
          note: '',
          startedAt: base,
          endedAt: base + Math.max(durSec, 1) * 1000,
          sets: [set],
        })
      }
      setWalkDist(0)
      setWalkMin(0)
      setWalkSec(0)
      setWalkFormKey((k) => k + 1)
      showToast(`Jalan ${fmtNumber(walkDist)} km tersimpan`)
    } catch {
      showToast('Gagal menyimpan — cek koneksi internet', 'error')
    } finally {
      setWalkBusy(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">Cardio — Catat jalan</div>
      <div className="small muted" style={{ marginBottom: 8 }}>
        Dari sesi Cardio Day — catat manual dari Strava (jarak + durasi — elevasi isi manual di sesi).
      </div>
      <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>＋ Catat jalan hari ini</div>
      <div className="row wrap" style={{ gap: 6, marginBottom: 6 }}>
        <input
          className="input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={walkDateText}
          onChange={(e) => setWalkDateText(e.target.value)}
          placeholder="HH/BB/TTTT"
          aria-label="Tanggal DD/MM/YYYY"
          style={{ width: 104 }}
        />
        <button className="btn sm ghost" onClick={() => setWalkDateText(formatDMYInput(today))}>Hari ini</button>
        <button className="btn sm ghost" onClick={() => setWalkDateText(formatDMYInput(addDays(today, -1)))}>Kemarin</button>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <DecimalInput
          key={`d${walkFormKey}`}
          value={walkDist}
          onCommit={setWalkDist}
          placeholder="km"
          className="input"
          ariaLabel="Jarak km"
          style={{ width: 76 }}
        />
        <DecimalInput
          key={`m${walkFormKey}`}
          value={walkMin}
          onCommit={setWalkMin}
          placeholder="mnt"
          className="input"
          ariaLabel="Durasi menit"
          style={{ width: 76 }}
        />
        <DecimalInput
          key={`s${walkFormKey}`}
          value={walkSec}
          onCommit={setWalkSec}
          placeholder="dtk"
          className="input"
          ariaLabel="Durasi detik"
          style={{ width: 76 }}
        />
        <button className="btn sm primary" disabled={walkBusy} onClick={() => void saveQuickWalk()}>
          {walkBusy ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}
