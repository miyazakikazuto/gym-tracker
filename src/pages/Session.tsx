import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { updateSession, deleteSession, makeSetId } from '../lib/gymstore'
import { formatHM, formatDMYWIB } from '../lib/date'
import { getExerciseName, lastSetResult, categoryOfExercise, exerciseIsDuration, bestSetResult } from '../lib/helpers'
import { presetByName } from '../lib/templates'
import type { SessionSet } from '../types'

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

  function scheduleSync(nextSets: SessionSet[]) {
    setSyncPending(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await updateSession(uid, sid, { sets: nextSets })
      setSyncPending(false)
    }, 400)
  }

  function mutateSets(next: SessionSet[]) {
    setLocalSets(next)
    scheduleSync(next)
  }

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
    if (prev) {
      w = prev.weightKg
      r = dur ? 0 : prev.reps
      d = dur ? prev.durationSec ?? 0 : undefined
    } else {
      const best = bestSetResult(sessions, sid, exerciseId)
      if (best) {
        w = best.weightKg
        r = dur ? 0 : best.reps
        d = dur ? best.durationSec ?? 0 : undefined
      }
    }
    mutateSets([
      ...localSets,
      { id: makeSetId(), exerciseId, setNumber: setNo, weightKg: w, reps: r, ...(d !== undefined ? { durationSec: d } : {}) },
    ])
  }

  function removeSet(setId: string) {
    mutateSets(localSets.filter((s) => s.id !== setId))
  }

  function patchSet(setId: string, patch: Partial<SessionSet>) {
    mutateSets(localSets.map((s) => (s.id === setId ? { ...s, ...patch } : s)))
  }

  function patchNote(next: string) {
    setNote(next)
    setSyncPending(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await updateSession(uid, sid, { note: next.trim() })
      setSyncPending(false)
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
      await updateSession(uid, sid, { rpes: next })
      setSyncPending(false)
    }, 400)
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
    return cat ? exercises.filter((e) => categoryOfExercise(e) === cat) : exercises
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
        return (
        <div className="card" key={exId}>
            <div className="card-title">
              <span>{getExerciseName(exercises, exId)}</span>
              <button className="btn sm ghost" onClick={() => addSet(exId)}>+ Set</button>
            </div>
          <div className="row small muted" style={{ padding: '2px 0 6px' }}>
            <span className="num">#</span>
            <span className="grow">Beban (kg)</span>
            <span style={{ width: 60, textAlign: 'center' }}>{dur ? 'Durasi (dtk)' : 'Rep'}</span>
            <span style={{ width: 32 }} />
          </div>
          {sets.slice().sort((a, b) => a.setNumber - b.setNumber).map((s) => {
            const prev = lastSetResult(sessions, sid, exId, s.setNumber)
            return (
              <div className="set-row" key={s.id}>
                <span className="num">{s.setNumber}</span>
                <input
                  className="wt"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={s.weightKg || ''}
                  placeholder={prev ? String(prev.weightKg) : '0'}
                  onChange={(e) => patchSet(s.id, { weightKg: Number(e.target.value) })}
                />
                <input
                  className="wt"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={dur ? s.durationSec || '' : s.reps || ''}
                  placeholder={prev ? String(dur ? prev.durationSec ?? '' : prev.reps) : '0'}
                  onChange={(e) => patchSet(s.id, dur ? { durationSec: Number(e.target.value) } : { reps: Number(e.target.value) })}
                />
                <button className="icon-btn danger" onClick={() => removeSet(s.id)}>✕</button>
              </div>
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