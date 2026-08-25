import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { updateSession, deleteSession, makeSetId } from '../lib/gymstore'
import { formatHM, formatDMYWIB } from '../lib/date'
import { getExerciseName, categoryKeysOfExercise, exerciseIsDuration, bestSetResult, fmtNumber } from '../lib/helpers'
import { e1rm } from '../lib/e1rm'
import { parseDecimal } from '../lib/parse'
import { presetByName } from '../lib/templates'
import { getPrescribedWeights, getScheme, getSbdLiftForSession, computeExcludedTypes } from '../lib/progression'
import Modal from '../components/Modal'
import type { SessionSet } from '../types'

interface SetResult {
  weightKg: number
  reps: number
  durationSec?: number
  distanceKm?: number
  elevationM?: number
}

export default function Session() {
  const { id } = useParams<{ id: string }>()
  const uid = useUid()
  const navigate = useNavigate()
  const { sessions, exercises, settings, ready, showToast } = useData()

  const session = sessions.find((s) => s.id === id)
  const [note, setNote] = useState(session?.note ?? '')
  const [localSets, setLocalSets] = useState<SessionSet[]>(session?.sets ?? [])
  const [localRpes, setLocalRpes] = useState<Record<string, number>>(session?.rpes ?? {})
  const [syncPending, setSyncPending] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  // Timer terpisah per jenis data — aksi satu jenis tidak membatalkan write jenis lain
  const setsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rpeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWrittenRef = useRef('')
  const pendingCount = useRef(0)
  // Perubahan yang belum sukses ditulis — dipakai untuk flush saat keluar halaman
  const dirtyRef = useRef<{ sets?: SessionSet[]; note?: string; rpes?: Record<string, number> }>({})

  // Lookup best e1RM per gerakan — dibangun sekali per data, bukan scan per render
  const bestE1RmMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      if (s.id === id || s.endedAt === null) continue
      for (const set of s.sets) {
        if (set.weightKg <= 0) continue
        const e = e1rm(set.weightKg, set.reps)
        if (e > (map.get(set.exerciseId) ?? 0)) map.set(set.exerciseId, e)
      }
    }
    return map
  }, [sessions, id])

  // Lookup hasil set terakhir per (gerakan, set ke-N) — sesi selesai, terbaru dulu
  const lastSetMap = useMemo(() => {
    const map = new Map<string, Map<number, SetResult>>()
    const finished = sessions
      .filter((s) => s.id !== id && s.endedAt !== null)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.startedAt - a.startedAt))
    for (const s of finished) {
      for (const set of s.sets) {
        const hasData = set.weightKg > 0 || set.durationSec != null || (set.distanceKm ?? 0) > 0
        if (!hasData) continue
        let bySet = map.get(set.exerciseId)
        if (!bySet) {
          bySet = new Map()
          map.set(set.exerciseId, bySet)
        }
        if (!bySet.has(set.setNumber)) {
          bySet.set(set.setNumber, {
            weightKg: set.weightKg,
            reps: set.reps,
            durationSec: set.durationSec,
            distanceKm: set.distanceKm,
            elevationM: set.elevationM,
          })
        }
      }
    }
    return map
  }, [sessions, id])

  // Autosave dengan diff: tulis Firestore hanya jika nilai benar-benar berubah
  const scheduleSync = useCallback(
    (nextSets: SessionSet[]) => {
      if (!id) return
      const json = JSON.stringify(nextSets)
      if (json === lastWrittenRef.current) {
        // Sudah tersimpan di server → tidak ada yang perlu ditulis
        delete dirtyRef.current.sets
        return
      }
      dirtyRef.current.sets = nextSets
      setSyncPending(true)
      pendingCount.current++
      if (setsTimer.current) clearTimeout(setsTimer.current)
      setsTimer.current = setTimeout(async () => {
        try {
          await updateSession(uid, id, { sets: nextSets })
          // Ref baru di-update SETELAH write sukses — kalau gagal, edit tetap dicoba lagi
          lastWrittenRef.current = json
          if (dirtyRef.current.sets === nextSets) delete dirtyRef.current.sets
        } catch {
          /* gagal: tetap dirty → ditulis ulang saat aksi berikutnya / keluar halaman */
        } finally {
          pendingCount.current = Math.max(0, pendingCount.current - 1)
          if (pendingCount.current === 0) setSyncPending(false)
        }
      }, 400)
    },
    [uid, id],
  )

  const mutateSets = useCallback(
    (next: SessionSet[]) => {
      setLocalSets(next)
      scheduleSync(next)
    },
    [scheduleSync],
  )

  const patchSet = useCallback(
    (setId: string, patch: Partial<SessionSet>) => {
      setLocalSets((cur) => {
        const next = cur.map((s) => (s.id === setId ? { ...s, ...patch } : s))
        scheduleSync(next)
        return next
      })
    },
    [scheduleSync],
  )

  const removeSet = useCallback(
    (setId: string) => {
      setLocalSets((cur) => {
        const next = cur.filter((s) => s.id !== setId)
        scheduleSync(next)
        return next
      })
    },
    [scheduleSync],
  )

  const stepWeight = useCallback(
    (setId: string, delta: number) => {
      setLocalSets((cur) => {
        const s = cur.find((x) => x.id === setId)
        if (!s) return cur
        const next = cur.map((x) =>
          x.id === setId ? { ...x, weightKg: Math.max(0, Math.round((s.weightKg + delta) * 10) / 10) } : x,
        )
        scheduleSync(next)
        return next
      })
    },
    [scheduleSync],
  )

  useEffect(() => {
    if (session) {
      setNote(session.note ?? '')
      setLocalSets(session.sets)
      setLocalRpes(session.rpes ?? {})
    }
  }, [id, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flush best-effort saat keluar halaman: tulis perubahan yang belum sempat tersimpan
  useEffect(() => {
    return () => {
      ;[setsTimer, noteTimer, rpeTimer].forEach((t) => { if (t.current) clearTimeout(t.current) })
      const d = dirtyRef.current
      const payload: { sets?: SessionSet[]; note?: string; rpes?: Record<string, number> } = {}
      if (d.sets) payload.sets = d.sets
      if (d.note != null) payload.note = d.note
      if (d.rpes) payload.rpes = d.rpes
      if (Object.keys(payload).length > 0 && id) {
        updateSession(uid, id, payload).catch(() => undefined)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready || !session) {
    return <div className="empty">Memuat sesi…</div>
  }

  const isActive = session.endedAt === null
  const sid = session.id

  // Parse 5/3/1 context dari planName — mis. "[C1-S05] Leg Day — 3×3"
  const cycleMatch = session.planName.match(/\[C(\d+)-S(\d+)\]/)
  const planSessionIdx = cycleMatch ? Number(cycleMatch[2]) - 1 : -1
  const planExcluded = computeExcludedTypes(settings)
  const planScheme = planSessionIdx >= 0 ? getScheme(planSessionIdx, planExcluded) : null
  const planLift = planSessionIdx >= 0 ? getSbdLiftForSession(planSessionIdx, planExcluded) : undefined
  const planTM = settings.trainingMax

  function addSet(exerciseId: string) {
    const dur = exerciseIsDuration(exercises, exerciseId)
    const prev = localSets
      .filter((s) => s.exerciseId === exerciseId)
      .slice()
      .sort((a, b) => b.setNumber - a.setNumber)[0]
    const maxNo = localSets
      .filter((s) => s.exerciseId === exerciseId)
      .reduce((m, s) => Math.max(m, s.setNumber), 0)
    const setNo = maxNo + 1
    let w = 0
    let r = 0
    let d: number | undefined = dur ? 0 : undefined
    let d2: number | undefined = undefined
    let elev: number | undefined = undefined
    if (prev) {
      w = prev.weightKg
      r = dur ? 0 : prev.reps
      d = dur ? prev.durationSec ?? 0 : undefined
      d2 = prev.distanceKm
      elev = prev.elevationM
    } else if (planScheme && planTM && planLift) {
      // 5/3/1: pre-fill dari TM sesuai tipe sesi (Leg→Squat, Push→Bench, Pull→Deadlift)
      if (planTM[planLift] > 0) {
        const weights = getPrescribedWeights(planScheme, planTM[planLift])
        const prescribed = weights[setNo - 1] ?? weights[weights.length - 1]
        if (prescribed) { w = prescribed.weight; r = typeof prescribed.reps === 'number' ? prescribed.reps : 0 }
      }
      if (w === 0) {
        const best = bestSetResult(sessions, sid, exerciseId)
        if (best) {
          w = best.weightKg
          r = dur ? 0 : best.reps
          d = dur ? best.durationSec ?? 0 : undefined
          d2 = best.distanceKm
        }
      }
    } else {
      const best = bestSetResult(sessions, sid, exerciseId)
      if (best) {
        w = best.weightKg
        r = dur ? 0 : best.reps
        d = dur ? best.durationSec ?? 0 : undefined
        d2 = best.distanceKm
      }
    }
    mutateSets([
      ...localSets,
      { id: makeSetId(), exerciseId, setNumber: setNo, weightKg: w, reps: r, ...(d !== undefined ? { durationSec: d } : {}), ...(d2 !== undefined ? { distanceKm: d2 } : {}), ...(elev !== undefined ? { elevationM: elev } : {}) },
    ])
  }

  function patchNote(next: string) {
    setNote(next)
    const trimmed = next.trim()
    dirtyRef.current.note = trimmed
    setSyncPending(true)
    pendingCount.current++
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(async () => {
      try {
        await updateSession(uid, sid, { note: trimmed })
        if (dirtyRef.current.note === trimmed) delete dirtyRef.current.note
      } catch {
        /* gagal: tetap dirty, ditulis ulang saat keluar halaman */
      } finally {
        pendingCount.current = Math.max(0, pendingCount.current - 1)
        if (pendingCount.current === 0) setSyncPending(false)
      }
    }, 600)
  }

  function patchRpe(exerciseId: string, value: number | null) {
    const next = { ...localRpes }
    if (value === null) delete next[exerciseId]
    else next[exerciseId] = value
    setLocalRpes(next)
    dirtyRef.current.rpes = next
    setSyncPending(true)
    pendingCount.current++
    if (rpeTimer.current) clearTimeout(rpeTimer.current)
    rpeTimer.current = setTimeout(async () => {
      try {
        await updateSession(uid, sid, { rpes: next })
        if (dirtyRef.current.rpes === next) delete dirtyRef.current.rpes
      } catch {
        /* gagal: tetap dirty */
      } finally {
        pendingCount.current = Math.max(0, pendingCount.current - 1)
        if (pendingCount.current === 0) setSyncPending(false)
      }
    }, 400)
  }

  function isCardio(exId: string): boolean {
    const ex = exercises.find((e) => e.id === exId)
    if (!ex) return false
    return ex.muscleGroup === 'Cardio' || ex.category === 'cardio'
  }

  async function finish() {
    try {
      await updateSession(uid, sid, { note: note.trim(), endedAt: Date.now(), sets: localSets, rpes: localRpes })
    } catch {
      showToast('Gagal menyelesaikan sesi — cek koneksi internet')
      return
    }
    dirtyRef.current = {}
    ;[setsTimer, noteTimer, rpeTimer].forEach((t) => { if (t.current) clearTimeout(t.current) })
    navigate('/history')
  }

  async function saveDone() {
    try {
      await updateSession(uid, sid, { note: note.trim(), sets: localSets, rpes: localRpes })
    } catch {
      showToast('Gagal menyimpan — cek koneksi internet')
      return
    }
    dirtyRef.current = {}
    ;[setsTimer, noteTimer, rpeTimer].forEach((t) => { if (t.current) clearTimeout(t.current) })
    setSyncPending(false)
    navigate(-1)
  }

  async function del() {
    try {
      await deleteSession(uid, sid)
    } catch {
      showToast('Gagal menghapus sesi — cek koneksi internet')
      return
    }
    navigate('/')
  }

  const grouped = new Map<string, SessionSet[]>()
  for (const s of localSets) {
    const arr = grouped.get(s.exerciseId) ?? []
    arr.push(s)
    grouped.set(s.exerciseId, arr)
  }

  const addPool = (() => {
    const cat = presetByName(session.planName)?.key
    return cat ? exercises.filter((e) => categoryKeysOfExercise(e).includes(cat)) : exercises
  })()

  return (
    <div className="page">
      <div className="row spread">
        <div>
          <div className="page-title">{session.planName}</div>
          <div className="subtitle" style={{ marginBottom: 0 }}>
            {formatDMYWIB(session.date)} · mulai {formatHM(session.startedAt)}
            {session.endedAt && ` · selesai ${formatHM(session.endedAt)}`}
          </div>
        </div>
        <button className="icon-btn" aria-label="Hapus sesi" onClick={() => setConfirmDel(true)}>🗑</button>
      </div>

      <div className="row" style={{ margin: '12px 0' }}>
        <span className={'badge ' + (isActive ? 'warn' : 'ok')}>
          {isActive ? 'Berlangsung' : 'Selesai'}
        </span>
        <span className="badge">{localSets.length} set</span>
        {syncPending && <span className="badge">•• menyimpan</span>}
      </div>

      {grouped.size === 0 && (
        <div className="card empty">Belum ada gerakan. Tambahkan lewat tombol di bawah.</div>
      )}

      {Array.from(grouped.entries()).map(([exId, sets]) => {
        const dur = exerciseIsDuration(exercises, exId)
        const cardio = isCardio(exId)
        const e1RmRef = bestE1RmMap.get(exId) ?? 0
        return (
        <div className="card" key={exId}>
            <div className="card-title">
              <span>
                {getExerciseName(exercises, exId)}
                {!cardio && e1RmRef > 0 && (
                  <span className="badge accent" style={{ marginLeft: 8 }}>e1RM ~{fmtNumber(e1RmRef)} kg</span>
                )}
              </span>
              <button className="btn sm ghost" onClick={() => addSet(exId)}>+ Set</button>
            </div>
          <div className="row small muted" style={{ padding: '2px 0 6px' }}>
            <span className="num">#</span>
            {!cardio && <span className="grow">Beban (kg)</span>}
            {cardio ? (
              <>
                <span style={{ width: 76, textAlign: 'center' }}>Durasi</span>
                <span style={{ width: 60, textAlign: 'center' }}>Jarak</span>
                <span style={{ width: 60, textAlign: 'center' }}>Elevasi</span>
                <span style={{ width: 56, textAlign: 'center' }}>Pace</span>
              </>
            ) : (
              <>
                <span style={{ width: 76, textAlign: 'center' }}>{dur ? 'Durasi (j·mnt)' : 'Rep'}</span>
                {dur && <span style={{ width: 60, textAlign: 'center' }}>Jarak (km)</span>}
                <span className="int">Int</span>
              </>
            )}
            <span style={{ width: 32 }} />
          </div>
          {sets.slice().sort((a, b) => a.setNumber - b.setNumber).map((s) => {
            const prev = lastSetMap.get(exId)?.get(s.setNumber) ?? null
            const pct = !cardio && !dur && s.weightKg > 0 && s.reps > 0 && e1RmRef > 0
              ? (s.weightKg / e1RmRef) * 100
              : null
            return (
              <SetRow
                key={s.id}
                s={s}
                dur={dur}
                isCardio={cardio}
                prev={prev}
                pct={pct}
                onStep={stepWeight}
                onPatch={patchSet}
                onRemove={removeSet}
              />
            )
          })}
          <div className="row" style={{ marginTop: 8 }}>
            <span className="small muted">RPE</span>
            {[6, 7, 8, 9, 10].map((r) => (
              <button
                key={r}
                className={'rpe-chip' + (localRpes[exId] === r ? ' active' : '')}
                onClick={() => patchRpe(exId, localRpes[exId] === r ? null : r)}
              >
                {r}
              </button>
            ))}
            {localRpes[exId] !== undefined && (
              <span className="small muted" style={{ marginLeft: 'auto' }}>
                {localRpes[exId] === 10 ? 'maksimal' : localRpes[exId] === 9 ? '1 sisa' : localRpes[exId] === 8 ? '2 sisa' : localRpes[exId] === 7 ? '3 sisa' : 'ringan'}
              </span>
            )}
          </div>
        </div>
        )
      })}

      <div className="card">
        <div className="card-title">Tambahkan gerakan</div>
        {exercises.length === 0 ? (
          <div className="small muted">Belum ada gerakan di database. Tambahkan di tab Gerakan.</div>
        ) : addPool.length === 0 ? (
          <div className="small muted">
            Belum ada gerakan kategori {presetByName(session.planName)?.name}. Tambahkan di tab Gerakan.
          </div>
        ) : (
          <div className="row wrap">
            {addPool.map((ex) => (
              <button key={ex.id} className="btn sm ghost" onClick={() => addSet(ex.id)}>
                + {ex.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label>Catatan sesi</label>
        <textarea
          className="input"
          value={note}
          onChange={(e) => patchNote(e.target.value)}
          rows={2}
          placeholder="Cara badan hari ini, PR, dll…"
        />
      </div>

      <div className="form-actions">
        {isActive ? (
          <button className="btn ok" onClick={() => finish()}>✓ Selesai latihan</button>
        ) : (
          <button className="btn ok" onClick={() => saveDone()}>✓ Simpan perubahan</button>
        )}
        <button className="btn ghost" onClick={() => navigate(-1)}>Kembali</button>
      </div>

      {confirmDel && (
        <Modal onClose={() => setConfirmDel(false)} label="Hapus sesi">
          <h3>Hapus sesi ini?</h3>
          <div className="small muted" style={{ marginBottom: 10 }}>
            "{session.planName}" ({formatDMYWIB(session.date)}) akan dihapus permanen.
          </div>
          <div className="form-actions">
            <button className="btn ghost" onClick={() => setConfirmDel(false)}>Batal</button>
            <button className="btn danger" onClick={() => { setConfirmDel(false); void del() }}>Hapus</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const SetRow = memo(function SetRow({
  s,
  dur,
  isCardio,
  prev,
  pct,
  onStep,
  onPatch,
  onRemove,
}: {
  s: SessionSet
  dur: boolean
  isCardio: boolean
  prev: SetResult | null
  pct: number | null
  onStep: (id: string, delta: number) => void
  onPatch: (id: string, patch: Partial<SessionSet>) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="set-row">
      <span className="num">{s.setNumber}</span>
      {isCardio ? (
        <>
          <div className="row" style={{ gap: 2, alignItems: 'center' }}>
            <input
              className="wt"
              type="number"
              inputMode="numeric"
              min={0}
              style={{ width: 32, textAlign: 'center' }}
              value={Math.floor((s.durationSec ?? 0) / 3600) || ''}
              placeholder="0"
              onChange={(e) => {
                const h = Number(e.target.value) || 0
                const m = Math.floor(((s.durationSec ?? 0) % 3600) / 60)
                onPatch(s.id, { durationSec: h * 3600 + m * 60 })
              }}
            />
            <span className="small muted">j</span>
            <input
              className="wt"
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              style={{ width: 32, textAlign: 'center' }}
              value={Math.floor(((s.durationSec ?? 0) % 3600) / 60) || ''}
              placeholder="0"
              onChange={(e) => {
                const m = Number(e.target.value) || 0
                const h = Math.floor((s.durationSec ?? 0) / 3600)
                onPatch(s.id, { durationSec: h * 3600 + m * 60 })
              }}
            />
            <span className="small muted">mnt</span>
          </div>
          <input
            className="wt dist"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={s.distanceKm ? fmtNumber(s.distanceKm) : ''}
            placeholder={prev && prev.distanceKm ? fmtNumber(prev.distanceKm) : '0'}
            onChange={(e) => {
              const n = parseDecimal(e.target.value)
              if (n !== null) onPatch(s.id, { distanceKm: n })
            }}
          />
          <input
            className="wt"
            type="number"
            inputMode="numeric"
            min={0}
            value={s.elevationM || ''}
            placeholder={prev && prev.elevationM ? String(prev.elevationM) : '0'}
            onChange={(e) => onPatch(s.id, { elevationM: Number(e.target.value) })}
          />
          <span className="small muted" style={{ width: 56, textAlign: 'center' }}>
            {s.durationSec && s.distanceKm ? paceStr(s.durationSec / 60, s.distanceKm) + '/km' : '—'}
          </span>
        </>
      ) : (
        <>
          <button className="step-btn" onClick={() => onStep(s.id, -0.5)} disabled={!s.weightKg}>−</button>
          <input
            className="wt"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={s.weightKg ? fmtNumber(s.weightKg) : ''}
            placeholder={prev ? fmtNumber(prev.weightKg) : '0'}
            onChange={(e) => {
              const n = parseDecimal(e.target.value)
              if (n !== null) onPatch(s.id, { weightKg: n })
            }}
          />
          <button className="step-btn" onClick={() => onStep(s.id, 0.5)}>＋</button>
          {dur ? (
            // Durasi pakai jam + menit (bukan detik mentah) — konsisten dengan
            // baris cardio. Backend tetap simpan durationSec.
            <div className="row" style={{ gap: 2, alignItems: 'center', width: 76 }}>
              <input
                className="wt"
                type="number"
                inputMode="numeric"
                min={0}
                style={{ width: 30, textAlign: 'center' }}
                value={Math.floor((s.durationSec ?? 0) / 3600) || ''}
                placeholder="0"
                onChange={(e) => {
                  const h = Number(e.target.value) || 0
                  const m = Math.floor(((s.durationSec ?? 0) % 3600) / 60)
                  onPatch(s.id, { durationSec: h * 3600 + m * 60 })
                }}
              />
              <span className="small muted">j</span>
              <input
                className="wt"
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                style={{ width: 30, textAlign: 'center' }}
                value={Math.floor(((s.durationSec ?? 0) % 3600) / 60) || ''}
                placeholder="0"
                onChange={(e) => {
                  const m = Number(e.target.value) || 0
                  const h = Math.floor((s.durationSec ?? 0) / 3600)
                  onPatch(s.id, { durationSec: h * 3600 + m * 60 })
                }}
              />
            </div>
          ) : (
            <input
              className="wt"
              type="number"
              inputMode="numeric"
              min={0}
              value={s.reps || ''}
              placeholder={prev ? String(prev.reps) : '0'}
              onChange={(e) => onPatch(s.id, { reps: Number(e.target.value) })}
            />
          )}
          {dur && (
            <input
              className="wt dist"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={s.distanceKm ? fmtNumber(s.distanceKm) : ''}
              placeholder={prev && prev.distanceKm ? fmtNumber(prev.distanceKm) : '0'}
              onChange={(e) => {
                const n = parseDecimal(e.target.value)
                if (n !== null) onPatch(s.id, { distanceKm: n })
              }}
            />
          )}
          {pct !== null ? (
            <span className={'int int-' + intZone(pct)}>~{Math.round(pct)}%</span>
          ) : (
            <span className="int" />
          )}
        </>
      )}
      <button className="icon-btn danger" aria-label={`Hapus set ${s.setNumber}`} onClick={() => onRemove(s.id)}>✕</button>
    </div>
  )
})

function intZone(pct: number): string {
  if (pct < 60) return 'recovery'
  if (pct < 75) return 'hypert'
  if (pct < 90) return 'strength'
  return 'peak'
}

function paceStr(minutes: number, km: number): string {
  const p = minutes / km
  const m = Math.floor(p)
  const s = Math.round((p - m) * 60)
  return m + ':' + (s < 10 ? '0' + s : s)
}