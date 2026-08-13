import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { updateSession, deleteSession, makeSetId } from '../lib/gymstore'
import { formatHM, formatDMYWIB } from '../lib/date'
import { getExerciseName, categoryKeysOfExercise, exerciseIsDuration, bestSetResult, fmtNumber } from '../lib/helpers'
import { presetByName } from '../lib/templates'
import type { SessionSet } from '../types'

interface SetResult {
  weightKg: number
  reps: number
  durationSec?: number
  distanceKm?: number
}

export default function Session() {
  const { id } = useParams<{ id: string }>()
  const uid = useUid()
  const navigate = useNavigate()
  const { sessions, exercises, ready } = useData()

  const session = sessions.find((s) => s.id === id)
  const [note, setNote] = useState(session?.note ?? '')
  const [localSets, setLocalSets] = useState<SessionSet[]>(session?.sets ?? [])
  const [localRpes, setLocalRpes] = useState<Record<string, number>>(session?.rpes ?? {})
  const [syncPending, setSyncPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWrittenRef = useRef('')

  // Lookup best e1RM per gerakan — dibangun sekali per data, bukan scan per render
  const bestE1RmMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      if (s.id === id || s.endedAt === null) continue
      for (const set of s.sets) {
        if (set.weightKg <= 0) continue
        const e = set.weightKg * (1 + set.reps / 30)
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
      if (json === lastWrittenRef.current) return
      lastWrittenRef.current = json
      setSyncPending(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        try {
          await updateSession(uid, id, { sets: nextSets })
        } catch {
          /* snapshot akan menyinkronkan */
        } finally {
          setSyncPending(false)
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

  if (!ready || !session) {
    return <div className="empty">Memuat sesi…</div>
  }

  const isActive = session.endedAt === null
  const sid = session.id

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
    if (prev) {
      w = prev.weightKg
      r = dur ? 0 : prev.reps
      d = dur ? prev.durationSec ?? 0 : undefined
      d2 = prev.distanceKm
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
      { id: makeSetId(), exerciseId, setNumber: setNo, weightKg: w, reps: r, ...(d !== undefined ? { durationSec: d } : {}), ...(d2 !== undefined ? { distanceKm: d2 } : {}) },
    ])
  }

  function patchNote(next: string) {
    setNote(next)
    setSyncPending(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await updateSession(uid, sid, { note: next.trim() })
      } catch {
        /* snapshot akan menyinkronkan */
      } finally {
        setSyncPending(false)
      }
    }, 600)
  }

  function patchRpe(exerciseId: string, value: number | null) {
    const next = { ...localRpes }
    if (value === null) delete next[exerciseId]
    else next[exerciseId] = value
    setLocalRpes(next)
    setSyncPending(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await updateSession(uid, sid, { rpes: next })
      } catch {
        /* snapshot akan menyinkronkan */
      } finally {
        setSyncPending(false)
      }
    }, 400)
  }

  function isCardio(exId: string): boolean {
    return exercises.find((e) => e.id === exId)?.muscleGroup === 'Cardio'
  }

  async function finish() {
    await updateSession(uid, sid, { note: note.trim(), endedAt: Date.now(), sets: localSets, rpes: localRpes })
    navigate('/history')
  }

  async function saveDone() {
    await updateSession(uid, sid, { note: note.trim(), sets: localSets, rpes: localRpes })
    setSyncPending(false)
    navigate(-1)
  }

  async function del() {
    if (!confirm('Hapus sesi ini?')) return
    await deleteSession(uid, sid)
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
        <button className="icon-btn" onClick={() => del()}>🗑</button>
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
            <span className={cardio ? 'grow' : ''} style={{ width: cardio ? undefined : 60, textAlign: 'center' }}>{dur ? 'Durasi (dtk)' : 'Rep'}</span>
            {cardio && dur && <span style={{ width: 60, textAlign: 'center' }}>Jarak (km)</span>}
            {!cardio && <span className="int">Int</span>}
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
  function parseDec(raw: string): number | null {
    const n = Number(raw.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  return (
    <div className="set-row">
      <span className="num">{s.setNumber}</span>
      {!isCardio && (
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
          const n = parseDec(e.target.value)
          if (n !== null) onPatch(s.id, { weightKg: n })
        }}
      />
      <button className="step-btn" onClick={() => onStep(s.id, 0.5)}>＋</button>
      </>
      )}
      <input
        className="wt"
        type="number"
        inputMode="numeric"
        min={0}
        value={dur ? s.durationSec || '' : s.reps || ''}
        placeholder={prev ? String(dur ? prev.durationSec ?? '' : prev.reps) : '0'}
        onChange={(e) => onPatch(s.id, dur ? { durationSec: Number(e.target.value) } : { reps: Number(e.target.value) })}
      />
      {isCardio && dur && (
        <input
          className="wt dist"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={s.distanceKm ? fmtNumber(s.distanceKm) : ''}
          placeholder={prev && prev.distanceKm ? fmtNumber(prev.distanceKm) : '0'}
          onChange={(e) => {
            const n = parseDec(e.target.value)
            if (n !== null) onPatch(s.id, { distanceKm: n })
          }}
        />
      )}
      {!isCardio && (
        pct !== null ? (
          <span className={'int int-' + intZone(pct)}>~{Math.round(pct)}%</span>
        ) : (
          <span className="int" />
        )
      )}
      <button className="icon-btn danger" onClick={() => onRemove(s.id)}>✕</button>
    </div>
  )
})

function intZone(pct: number): string {
  if (pct < 60) return 'recovery'
  if (pct < 75) return 'hypert'
  if (pct < 90) return 'strength'
  return 'peak'
}