import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useUid } from '../context/AuthContext'
import { parseKey, todayKey, formatDMYWIB, MONTHS } from '../lib/date'
import { buildSession, createSession } from '../lib/gymstore'
import { isRest, dotColorFor, shortLabelFor, PLAN_PRESETS } from '../lib/templates'
import { shiftForDate, SHIFT_LABELS, SHIFT_COLORS, SHIFT_TYPES } from '../lib/shift'
import { computePosition, getScheme, computeExcludedTypes } from '../lib/progression'
import Modal from '../components/Modal'
import SessionRow from '../components/SessionRow'
import { exerciseIsDuration } from '../lib/helpers'
import type { WorkoutPlan } from '../types'

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
  const { sessions, plans, exercises, settings, saveSettings } = useData()
  const uid = useUid()
  const navigate = useNavigate()

  const t = parseKey(todayKey())
  const [viewYear, setViewYear] = useState(t.getUTCFullYear())
  const [viewMonth, setViewMonth] = useState(t.getUTCMonth())
  // Preferensi tampilan kalender — tersimpan di localStorage (gt:calPrefs)
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('gt:calPrefs')
      if (raw) {
        const p = JSON.parse(raw) as { expanded?: boolean; showShift?: boolean }
        if (typeof p.expanded === 'boolean') return p.expanded
      }
    } catch {
      /* localStorage tidak tersedia — pakai default */
    }
    return true
  })
  const [showShift, setShowShift] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('gt:calPrefs')
      if (raw) {
        const p = JSON.parse(raw) as { expanded?: boolean; showShift?: boolean }
        if (typeof p.showShift === 'boolean') return p.showShift
      }
    } catch {
      /* localStorage tidak tersedia — pakai default */
    }
    return true
  })

  // Simpan preferensi setiap kali berubah
  useEffect(() => {
    try {
      localStorage.setItem('gt:calPrefs', JSON.stringify({ expanded, showShift }))
    } catch {
      /* mode private / penuh — abaikan */
    }
  }, [expanded, showShift])
  const [selKey, setSelKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [historyExtra, setHistoryExtra] = useState(false)
  const [error, setError] = useState('')
  const [visibleCount, setVisibleCount] = useState(30)

  const cells = monthGrid(viewYear, viewMonth)
  const selShift = selKey ? shiftForDate(selKey, settings) : null

  useEffect(() => {
    if (selKey) {
      const has = sessions.some((s) => s.date === selKey && !isRest(s.planName))
      setHistoryExtra(has)
    }
  }, [selKey, sessions])

  function shift(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setViewMonth(m)
    setViewYear(y)
    setVisibleCount(30)
  }

    const monthPrefix = viewYear + '-' + String(viewMonth + 1).padStart(2, '0')
  const list = sessions
    .filter((s) => s.date.startsWith(monthPrefix) && !isRest(s.planName))
    .sort((a, b) => (b.date < a.date ? -1 : 1))
  const daySessions = selKey ? sessions.filter((s) => s.date === selKey) : []
  const usedPlanNames = daySessions.map((s) => s.planName)
  const presetNames = PLAN_PRESETS.map((p) => p.name)
  const addOptions = PLAN_PRESETS
    .map((preset) => ({
      preset,
      plan: plans.find((p) => p.name === preset.name),
    }))
    .filter(({ preset }) => !usedPlanNames.includes(preset.name))
  // Jadwal kustom milik user (bukan preset) — juga bisa dipakai untuk sesi manual
  const customPlans = plans.filter((p) => !presetNames.includes(p.name) && !usedPlanNames.includes(p.name))

  async function handleCreate(plan: WorkoutPlan | null | undefined, name: string, isExtra?: boolean) {
    if (!selKey) return
    setCreating(true)
    setError('')
    try {
      const wantExtra = isExtra ?? historyExtra
      const startAt = parseKey(selKey).getTime() + 12 * 60 * 60 * 1000
      let payload: ReturnType<typeof buildSession>
      if (isRest(name)) {
        payload = buildSession(plan, selKey, (id) => (exerciseIsDuration(exercises, id) ? 'duration' : 'reps'), startAt, undefined, false)
      } else if (wantExtra) {
        payload = buildSession(plan, selKey, (id) => (exerciseIsDuration(exercises, id) ? 'duration' : 'reps'), startAt, undefined, true)
      } else {
        const ex = computeExcludedTypes(settings)
        const before = sessions.filter((x) => x.endedAt !== null && !x.isExtra && (x.date < selKey || (x.date === selKey && x.startedAt < startAt)))
        const pos = computePosition(before, ex, settings.skippedSessions ?? 0)
        const wave = getScheme(pos.sessionIndex, ex)?.label ?? null
        const stiker = `[C${pos.cycle}-S${String(pos.sessionIndex + 1).padStart(2, '0')}] ${name}${wave ? ` — ${wave}` : ''}`
        payload = buildSession(
          plan,
          selKey,
          (id) => (exerciseIsDuration(exercises, id) ? 'duration' : 'reps'),
          startAt,
          wave
            ? { cycle: pos.cycle, sessionIndex: pos.sessionIndex, cycleLabel: stiker, scheme: wave }
            : { cycle: pos.cycle, sessionIndex: pos.sessionIndex, cycleLabel: stiker },
          false,
        )
      }
      payload.planName = name
      const ref = await createSession(uid, payload)
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
        <div className="cal-tools">
          <button
            className={'cal-shift-toggle' + (showShift ? ' on' : '')}
            onClick={() => setShowShift((v) => !v)}
            aria-pressed={showShift}
          >
            <span className="chip-dot" style={{ background: showShift ? 'var(--accent)' : 'var(--muted)' }} />
            Shift {showShift ? 'On' : 'Off'}
          </button>
          <div className="cal-toggle">
            <button className={!expanded ? 'active' : ''} onClick={() => setExpanded(false)}>Ringkas</button>
            <button className={expanded ? 'active' : ''} onClick={() => setExpanded(true)}>Detail</button>
          </div>
        </div>
        <div className={'cal-grid' + (expanded ? ' detail' : '')}>
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
            const labels = Array.from(new Set(daySessions.map((s) => s.planName))).map((name) => ({
              text: shortLabelFor(name) || name.toUpperCase().slice(0, 4),
              color: dotColorFor(name) ?? (isRest(name) ? '#ff5c5c' : 'var(--muted)'),
            }))
            const sh = shiftForDate(key, settings)
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
                <span className="cal-day">{Number(key.slice(8, 10))}</span>
                {showShift && <span className="cal-shift" style={{ color: SHIFT_COLORS[sh] }}>{SHIFT_LABELS[sh][0]}</span>}
                {expanded && has && (
                  <>
                    {labels.slice(0, 3).map((l, j) => (
                      <span key={j} className="cal-tag" style={{ color: l.color }}>{l.text}</span>
                    ))}
                    {labels.length > 3 && <span className="cal-tag extra">+{labels.length - 3}</span>}
                  </>
                )}
                {!expanded && has && dotColors.length > 0 && (
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
        {showShift && (
          <>
            <div className="cal-legend">
              <span><span className="legend-dot" style={{ background: SHIFT_COLORS.pagi }} />Pagi</span>
              <span><span className="legend-dot" style={{ background: SHIFT_COLORS.sore }} />Sore</span>
              <span><span className="legend-dot" style={{ background: SHIFT_COLORS.malam }} />Malam</span>
              <span><span className="legend-dot" style={{ background: SHIFT_COLORS.libur }} />Libur</span>
            </div>
            <div className="small muted" style={{ margin: '10px 0 4px' }}>Rekap {MONTHS[viewMonth]} {viewYear}:</div>
            <div className="row wrap" style={{ gap: 6, marginBottom: 4 }}>
              {SHIFT_TYPES.map((sh) => {
                const n = cells.filter((k) => k && shiftForDate(k, settings) === sh).length
                return (
                  <span key={sh} className="badge" style={{ color: SHIFT_COLORS[sh], background: 'rgba(255,255,255,.07)' }}>
                    <span className="chip-dot" style={{ background: SHIFT_COLORS[sh] }} /> {SHIFT_LABELS[sh]} {n}
                  </span>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="row spread">
        <div className="card-title">Sesi latihan</div>
        <span className="small muted">{list.length} sesi bulan ini</span>
      </div>

      {list.length === 0 ? (
        <div className="card empty">Tidak ada sesi di bulan ini. Geser ‹ ›, atau ketuk tanggal di kalender.</div>
      ) : (
        <>
          {list.slice(0, visibleCount).map((s) => <SessionRow key={s.id} s={s} onOpen={() => navigate(`/session/${s.id}`)} />)}
          {list.length > visibleCount && (
            <button className="btn ghost wide" style={{ marginTop: 8 }} onClick={() => setVisibleCount((c) => c + 30)}>
              Tampilkan lebih banyak ({list.length - visibleCount} sisanya)
            </button>
          )}
        </>
      )}

      {selKey && (
        <Modal onClose={() => { if (!creating) setSelKey(null) }} label="Sesi">
            <h3>Sesi · {formatDMYWIB(selKey)}</h3>

            {selShift && (
              <div className="small" style={{ marginBottom: 8 }}>
                Shift: <b style={{ color: SHIFT_COLORS[selShift] }}>{SHIFT_LABELS[selShift]}</b>{' '}
                <span className={'badge ' + (settings.shiftOverride?.[selKey] ? 'warn' : 'ok')}>
                  {settings.shiftOverride?.[selKey] ? 'ditimpa' : 'otomatis'}
                </span>
              </div>
            )}
            <div className="small muted" style={{ marginBottom: 6 }}>
              Timpa shift tanggal ini (opsional):
            </div>
            <div className="row wrap" style={{ gap: 6, marginBottom: settings.shiftOverride?.[selKey] ? 8 : 12 }}>
              {SHIFT_TYPES.map((sh) => (
                <button
                  key={sh}
                  className={'chipb' + (selShift === sh ? ' on' : '')}
                  style={selShift === sh ? { background: SHIFT_COLORS[sh], borderColor: SHIFT_COLORS[sh], color: '#1a1230' } : undefined}
                  onClick={() => saveSettings({ shiftOverride: { ...settings.shiftOverride, [selKey]: sh } })}
                >
                  <span className="chip-dot" style={{ background: SHIFT_COLORS[sh] }} />
                  {SHIFT_LABELS[sh]}
                </button>
              ))}
            </div>
            {settings.shiftOverride?.[selKey] && (
              <div className="small muted" style={{ marginBottom: 12 }}>
                Tanggal ini ditimpa manual.{' '}
                <button
                  className="btn sm ghost"
                  style={{ marginLeft: 4 }}
                  onClick={() => {
                    const o = { ...settings.shiftOverride }
                    delete o[selKey]
                    saveSettings({ shiftOverride: o })
                  }}
                >
                  Kembalikan ke siklus otomatis
                </button>
              </div>
            )}

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

            <label className="row small" style={{ gap: 6, marginBottom: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={historyExtra} onChange={(e) => setHistoryExtra(e.target.checked)} />
              Sesi tambahan (tidak majuin siklus)
            </label>
            <div className="small muted" style={{ margin: daySessions.length ? '12px 0 8px' : '0 0 8px' }}>
              Tambah sesi untuk tanggal ini:
            </div>

            {addOptions.length === 0 && customPlans.length === 0 ? (
              <div className="small muted">Semua jadwal sudah punya sesi di tanggal ini.</div>
            ) : (
              <>
                {addOptions.map(({ preset, plan }) => (
                  <button
                    key={preset.name}
                    className="btn ghost wide"
                    style={{ justifyContent: 'flex-start', marginBottom: 8 }}
                    disabled={creating}
                    onClick={() => void handleCreate(plan, preset.name)}
                  >
                    + {preset.name}
                  </button>
                ))}
                {customPlans.length > 0 && (
                  <>
                    <div className="small muted" style={{ margin: '8px 0 6px' }}>Jadwal kustom:</div>
                    {customPlans.map((plan) => (
                      <button
                        key={plan.id}
                        className="btn ghost wide"
                        style={{ justifyContent: 'flex-start', marginBottom: 8 }}
                        disabled={creating}
                        onClick={() => void handleCreate(plan, plan.name)}
                      >
                        + {plan.name}
                      </button>
                    ))}
                  </>
                )}
              </>
            )}

            {error && <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>}

            <div className="form-actions">
              <button className="btn ghost" disabled={creating} onClick={() => setSelKey(null)}>Tutup</button>
            </div>
        </Modal>
      )}
    </div>
  )
}


