import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useUid } from '../context/AuthContext'
import { parseKey, todayKey, formatDMYWIB } from '../lib/date'
import { volumeOf } from '../lib/date'
import { buildSession, createSession } from '../lib/gymstore'
import { isRest, dotColorFor } from '../lib/templates'
import { fmtNumber } from '../lib/helpers'
import type { Session, WorkoutPlan } from '../types'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1))
  const startDow = first.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'))
  }
  return cells
}

export default function History() {
  const { sessions, plans } = useData()
  const uid = useUid()
  const navigate = useNavigate()

  const t = parseKey(todayKey())
  const [viewYear, setViewYear] = useState(t.getUTCFullYear())
  const [viewMonth, setViewMonth] = useState(t.getUTCMonth())
  const [selKey, setSelKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const cells = monthGrid(viewYear, viewMonth)

  function shift(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setViewMonth(m)
    setViewYear(y)
  }

  const list = sessions.slice().sort((a, b) => (b.date < a.date ? -1 : 1))
  const daySessions = selKey ? sessions.filter((s) => s.date === selKey) : []
  const usedPlanNames = daySessions.map((s) => s.planName)
  const availablePlans = plans.filter((p) => !usedPlanNames.includes(p.name))

  async function handleCreate(plan: WorkoutPlan | null) {
    if (!selKey) return
    setCreating(true)
    setError('')
    try {
      const ref = await createSession(uid, buildSession(plan, selKey))
      setSelKey(null)
      navigate(`/session/${ref.id}`)
    } catch (e) {
      setError((e as Error).message)
      setCreating(false)
    }
  }

  return (
    <div className="page">
      <div className="page-title">Riwayat</div>
      <div className="subtitle">Kalender latihan — ketuk tanggal untuk buka sesi / tambah data lama</div>

      <div className="card">
        <div className="cal-head">
          <button onClick={() => shift(-1)}>‹</button>
          <b>{MONTHS[viewMonth]} {viewYear}</b>
          <button onClick={() => shift(1)}>›</button>
        </div>
        <div className="cal-grid">
          {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((d, i) => (
            <div className="cal-dow" key={i}>{d}</div>
          ))}
          {cells.map((key, i) => {
            if (!key) return <div className="cal-cell empty" key={i} />
            const daySessions = sessions.filter((s) => s.date === key)
            const has = daySessions.length > 0
            const isToday = key === todayKey()
            const isSelected = key === selKey
            const isRestDay = daySessions.some((s) => isRest(s.planName))
            const dotColors = Array.from(new Set(daySessions.map((s) => dotColorFor(s.planName)).filter((c): c is string => !!c)))
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                className={'cal-cell' + (has ? ' has-session' : '') + (isToday ? ' today' : '') + (isSelected ? ' selected' : '') + (isRestDay ? ' rest-day' : '')}
                onClick={() => setSelKey(key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelKey(key)
                  }
                }}
              >
                {Number(key.slice(8, 10))}
                {has && !isToday && dotColors.length > 0 && (
                  <span className="dot">
                    {dotColors.slice(0, 3).map((c, j) => (
                      <span key={j} style={{ background: c }} />
                    ))}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="row spread">
        <div className="card-title">Sesi latihan</div>
        <span className="small muted">{list.filter((s) => s.date === todayKey()).length} hari ini</span>
      </div>

      {list.length === 0 ? (
        <div className="card empty">Belum ada sesi. Mulai dari tab Hari ini, atau ketuk tanggal di kalender.</div>
      ) : (
        list.slice(0, 20).map((s) => <SessionRow key={s.id} s={s} onOpen={() => navigate(`/session/${s.id}`)} />)
      )}

      {selKey && (
        <div className="modal-overlay" onClick={() => { if (!creating) setSelKey(null) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sesi · {formatDMYWIB(selKey)}</h3>

            {daySessions.length > 0 && (
              <>
                <div className="small muted" style={{ marginBottom: 8 }}>
                  {daySessions.length} sesi di tanggal ini:
                </div>
                {daySessions.map((s) => (
                  <div className="list-item" key={s.id}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{s.planName}</div>
                      <div className="small muted">{s.sets.length} set · {s.endedAt ? 'Selesai' : 'Berjalan'}</div>
                    </div>
                    <button
                      className="btn sm accent"
                      onClick={() => { const id = s.id; setSelKey(null); navigate(`/session/${id}`) }}
                    >
                      Buka
                    </button>
                  </div>
                ))}
              </>
            )}

            <div className="small muted" style={{ margin: daySessions.length ? '12px 0 8px' : '0 0 8px' }}>
              Tambah sesi untuk tanggal ini:
            </div>

            {plans.length === 0 ? (
              <div className="small muted">Belum ada jadwal. Atur jadwal lewat tab Hari Ini.</div>
            ) : (
              availablePlans.map((p) => (
                <button
                  key={p.id}
                  className="btn ghost wide"
                  style={{ justifyContent: 'flex-start', marginBottom: 8 }}
                  disabled={creating}
                  onClick={() => void handleCreate(p)}
                >
                  + {p.name}
                </button>
              ))
            )}

            {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}

            <div className="form-actions">
              <button className="btn ghost" disabled={creating} onClick={() => setSelKey(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionRow({ s, onOpen }: { s: Session; onOpen: () => void }) {
  const vol = volumeOf(s.sets)
  const topKg = s.sets.reduce((m, x) => Math.max(m, x.weightKg), 0)
  const name = s.planName || 'Sesi bebas'
  return (
    <div className="card" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="row spread">
        <b>{name}</b>
        <span className="small muted">{s.date.slice(8, 10)}/{s.date.slice(5, 7)}/{s.date.slice(0, 4)}</span>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <span className="badge">{s.sets.length} set</span>
        <span className="badge">{fmtNumber(vol)} kg volume</span>
        {topKg > 0 && <span className="badge accent">Top {fmtNumber(topKg)} kg</span>}
        {s.note && <span className="small muted">“{s.note.length > 40 ? s.note.slice(0, 40) + '…' : s.note}”</span>}
      </div>
    </div>
  )
}
