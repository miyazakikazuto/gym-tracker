import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { updateSession, deleteSession, makeSetId } from '../lib/gymstore'
import { formatHM, formatDMYWIB } from '../lib/date'
import { getExerciseName } from '../lib/helpers'
import type { SessionSet } from '../types'

export default function Session() {
  const { id } = useParams<{ id: string }>()
  const uid = useUid()
  const navigate = useNavigate()
  const { sessions, exercises, ready } = useData()

  const session = sessions.find((s) => s.id === id)
  const [note, setNote] = useState(session?.note ?? '')
  const [localSets, setLocalSets] = useState<SessionSet[]>(session?.sets ?? [])
  const [syncPending, setSyncPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (session) {
      setNote(session.note ?? '')
      setLocalSets(session.sets)
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
    if (!isActive) return
    const maxNo = localSets
      .filter((s) => s.exerciseId === exerciseId)
      .reduce((m, s) => Math.max(m, s.setNumber), 0)
    const setNo = maxNo + 1
    mutateSets([...localSets, makeSessionSet(exerciseId, setNo, 0, 0)])
  }

  function removeSet(setId: string) {
    if (!isActive) return
    mutateSets(localSets.filter((s) => s.id !== setId))
  }

  function patchSet(setId: string, patch: Partial<SessionSet>) {
    if (!isActive) return
    mutateSets(localSets.map((s) => (s.id === setId ? { ...s, ...patch } : s)))
  }

  async function finish() {
    await updateSession(uid, sid, { note: note.trim(), endedAt: Date.now(), sets: localSets })
    navigate('/history')
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

      {Array.from(grouped.entries()).map(([exId, sets]) => (
        <div className="card" key={exId}>
          <div className="card-title">
            <span>{getExerciseName(exercises, exId)}</span>
            <button className="btn sm ghost" onClick={() => addSet(exId)}>+ Set</button>
          </div>
          <div className="row small muted" style={{ padding: '2px 0 6px' }}>
            <span className="num">#</span>
            <span className="grow">Beban (kg)</span>
            <span style={{ width: 60, textAlign: 'center' }}>Rep</span>
            <span style={{ width: 32 }} />
          </div>
          {sets.slice().sort((a, b) => a.setNumber - b.setNumber).map((s) => (
            <div className="set-row" key={s.id}>
              <span className="num">{s.setNumber}</span>
              <input
                className="wt"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={s.weightKg || ''}
                placeholder="0"
                disabled={!isActive}
                onChange={(e) => patchSet(s.id, { weightKg: Number(e.target.value) })}
              />
              <input
                className="wt"
                type="number"
                inputMode="numeric"
                min={0}
                value={s.reps || ''}
                placeholder="0"
                disabled={!isActive}
                onChange={(e) => patchSet(s.id, { reps: Number(e.target.value) })}
              />
              <button className="icon-btn danger" disabled={!isActive} onClick={() => removeSet(s.id)}>✕</button>
            </div>
          ))}
        </div>
      ))}

      <div className="card">
        <div className="card-title">Tambahkan gerakan</div>
        {exercises.length === 0 ? (
          <div className="small muted">Belum ada gerakan di database. Tambahkan di tab Gerakan.</div>
        ) : (
          <div className="row wrap">
            {exercises.map((ex) => (
              <button key={ex.id} className="btn sm ghost" disabled={!isActive} onClick={() => addSet(ex.id)}>
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
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Cara badan hari ini, PR, dll…"
        />
      </div>

      <div className="form-actions">
        {isActive && (
          <button className="btn ok" onClick={() => finish()}>✓ Selesai latihan</button>
        )}
        <button className="btn ghost" onClick={() => navigate(-1)}>Kembali</button>
      </div>
    </div>
  )
}

function makeSessionSet(exerciseId: string, setNumber: number, weightKg: number, reps: number): SessionSet {
  return { id: makeSetId(), exerciseId, setNumber, weightKg, reps }
}