import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { DAY_NAMES, type WorkoutPlan } from '../types'
import { todayKey, addDays, dayOfWeek } from '../lib/date'
import { buildSession, createSession } from '../lib/gymstore'
import { shortLabelFor, isRest, presetByKey, presetByName, dotColorFor } from '../lib/templates'
import { exerciseIsDuration } from '../lib/helpers'
import {
  rotationOf,
  suggestKey,
  planForKey,
  freq7,
  freqByCategory,
  daysSinceLast,
  lastFinishedSession,
} from '../lib/rotation'
import { shiftForDate, SHIFT_LABELS, SHIFT_COLORS } from '../lib/shift'
import type { Session } from '../types'
import PlanEditor from '../components/PlanEditor'
import Modal from '../components/Modal'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

function DayStrip({
  days,
  base,
  sessions,
  plans,
}: {
  days: string[]
  base: string
  sessions: Session[]
  plans: WorkoutPlan[]
}) {
  return (
    <div className="day-strip">
      {days.map((key) => {
        const dow = dayOfWeek(key)
        const dd = key.slice(8, 10)
        const hasSession = sessions.some((s) => s.date === key && s.endedAt)
        const isToday = key === base
        const short = dow === 1 ? 'Sen' : DAY_NAMES[dow].slice(0, 3)
        const planForDow = plans.find((p) => p.dayOfWeek === dow)
        const label = planForDow ? shortLabelFor(planForDow.name) : ''
        const rest = planForDow ? isRest(planForDow.name) : false
        return (
          <div className={'day-chip' + (isToday ? ' today' : '') + (hasSession ? ' done' : '')} key={key}>
            <div className="dow">{short}</div>
            <div className="dnum">{dd}</div>
            {rest ? <div className="plan-label rest">REST</div> : label && <div className="plan-label">{label}</div>}
          </div>
        )
      })}
    </div>
  )
}

export default function Today() {
  const { user } = useAuth()
  const uid = useUid()
  const navigate = useNavigate()
  const { plans, exercises, sessions, settings, ready } = useData()
  const [showPlan, setShowPlan] = useState(false)
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [showPick, setShowPick] = useState(false)
  const [restToday, setRestToday] = useState(false)

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstallEvt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function installApp() {
    if (installEvt) {
      await installEvt.prompt()
      setInstallEvt(null)
    } else if (isIos) {
      setShowInstallGuide(true)
    }
  }

  const base = todayKey()
  const weekStart = addDays(base, -dayOfWeek(base))
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const nowDow = dayOfWeek(base)

  // ===== Mode Rotasi =====
  const rotationMode = settings.rotationMode !== false // default: aktif
  const rot = rotationOf(settings)
  const last = lastFinishedSession(sessions)
  const lastKey = last ? presetByName(last.planName)?.key : undefined
  const todayShift = shiftForDate(base, settings)
  const sug = suggestKey(settings, sessions, todayShift)
  const sugPlan = planForKey(plans, sug.key)
  const sugPreset = presetByKey(sug.key)
  const f7 = freq7(sessions, base)
  const catFreq = freqByCategory(sessions, base)
  const dsl = daysSinceLast(sessions, base)

  const todaySessions = sessions.filter((s) => s.date === base)
  const todayDone = todaySessions.some((s) => s.endedAt !== null)
  const activeSession = sessions.find((s) => s.date === base && s.endedAt === null)

  const todayPlan = plans.find((p) => p.dayOfWeek === nowDow)
  const todayIsRest = todayPlan ? isRest(todayPlan.name) : false

  const pickOptions = rot.rotation
    .map((k) => ({ key: k, plan: planForKey(plans, k) }))
    .filter((o): o is { key: string; plan: WorkoutPlan } => !!o.plan)
    .map((o) => ({
      key: o.key,
      name: o.plan.name,
      plan: o.plan,
      suggested: o.key === sug.key,
      sub: `${o.plan.items.length} gerakan`,
    }))

  const showStart = rotationMode ? !restToday && !todayDone : !todayIsRest

  const startLabel = activeSession
    ? 'Lanjutkan sesi hari ini'
    : rotationMode
      ? sugPlan
        ? `Mulai ${sugPreset?.shortLabel ?? sugPlan.name}`
        : 'Buat plan saran dulu'
      : todayPlan
        ? 'Mulai sesi hari ini'
        : 'Atur jadwal & mulai'

  async function createAndOpen(plan: WorkoutPlan | undefined | null, name?: string) {
    const payload = buildSession(
      plan,
      base,
      (id) => (exerciseIsDuration(exercises, id) ? 'duration' : 'reps'),
      Date.now(),
    )
    if (name) payload.planName = name
    const ref = await createSession(uid, payload)
    navigate(`/session/${ref.id}`)
  }

  function handleStart() {
    if (activeSession) {
      navigate(`/session/${activeSession.id}`)
      return
    }
    if (rotationMode) {
      if (!sugPlan) {
        setShowPlan(true)
        return
      }
      void createAndOpen(sugPlan)
      return
    }
    if (todayPlan && !todayIsRest) {
      void createAndOpen(todayPlan)
    } else {
      setShowPlan(true)
    }
  }

  return (
    <div className="page">
      <div className="row spread">
        <div>
          <div className="page-title">Gym Tracker</div>
          <div className="subtitle">Hari ini · {user?.email?.split('@')[0]}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!isStandalone && (installEvt || isIos) && (
            <button className="btn sm primary" onClick={() => void installApp()}>Pasang</button>
          )}
        </div>
      </div>

      {rotationMode ? (
        <>
          <div className="stat-row">
            <div className="stat">
              <div className="v">{f7}</div>
              <div className="l">Sesi · 7 hari</div>
            </div>
            <div className="stat">
              <div className="v">{dsl == null ? '—' : dsl === 0 ? 'Hari ini' : dsl === 1 ? 'Kemarin' : dsl + ' hari'}</div>
              <div className="l">Sejak latihan</div>
            </div>
          </div>

          <div className="row wrap" style={{ gap: 6 }}>
            {catFreq.length === 0 ? (
              <span className="small muted">Belum ada sesi minggu ini (Easy tidak dihitung)</span>
            ) : (
              catFreq.map((f) => (
                <span key={f.key} className="badge">
                  {presetByKey(f.key)?.shortLabel ?? f.key.toUpperCase()} {f.count}×
                </span>
              ))
            )}
          </div>

          <div className="card shift-card">
            <div className="card-title">
              <span className="row" style={{ gap: 8 }}>
                <span className="shift-dot" style={{ background: SHIFT_COLORS[todayShift] }} />
                <span>Shift minggu ini</span>
              </span>
              <span className="row" style={{ gap: 6 }}>
                <span className="badge" style={{ color: SHIFT_COLORS[todayShift], background: 'rgba(255,255,255,.07)' }}>
                  {SHIFT_LABELS[todayShift]}
                </span>
                <span className={'badge ' + (settings.shiftOverride?.[base] ? 'warn' : 'ok')}>
                  {settings.shiftOverride?.[base] ? 'ditimpa' : 'otomatis'}
                </span>
              </span>
            </div>
            <div className="shift-week">
              {Array.from({ length: 7 }, (_, i) => {
                const k = addDays(base, i)
                const sh = shiftForDate(k, settings)
                const isToday = k === base
                return (
                  <div
                    key={k}
                    className={'shift-week-cell' + (isToday ? ' today' : '')}
                    style={isToday ? { borderColor: SHIFT_COLORS[sh] } : undefined}
                  >
                    <div className="sw-dow">{i === 0 ? 'Hari ini' : DAY_NAMES[dayOfWeek(k)].slice(0, 3)}</div>
                    <div className="sw-dnum">{k.slice(8, 10)}</div>
                    <span className="sw-shift" style={{ background: SHIFT_COLORS[sh] }}>{SHIFT_LABELS[sh][0]}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card suggest">
            <div className="card-title">
              <span>Saran Hari Ini</span>
              {todayDone ? (
                <span className="badge" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>SELESAI ✓</span>
              ) : (
                <span className="badge warn">shift: {SHIFT_LABELS[todayShift]}</span>
              )}
            </div>
            {todayDone ? (
              <>
                <div className="suggest-big">
                  <span className="dot" style={{ background: last ? dotColorFor(last.planName) : 'var(--accent)' }} />
                  <span className="name">{last ? shortLabelFor(last.planName) || last.planName : 'Latihan'}</span>
                </div>
                <div className="suggest-meta">Sudah selesai hari ini — tidak ada saran tambahan.</div>
                <div className="small muted" style={{ marginTop: 4 }}>
                  Sesi berikutnya: {presetByKey(sug.key)?.shortLabel ?? sug.key.toUpperCase()} — mulai setelah istirahat cukup.
                </div>
                <div style={{ height: 10 }} />
                <button className="btn sm ghost wide" onClick={() => setShowPick(true)}>Tambah sesi lagi</button>
              </>
            ) : (
              <>
                <div className="suggest-big">
                  <span className="dot" style={{ background: sugPlan ? dotColorFor(sugPlan.name) : 'var(--accent)' }} />
                  <span className="name">{sugPreset?.shortLabel ?? sug.key.toUpperCase()}</span>
                </div>
                <div className="suggest-meta">
                  {last
                    ? `Latihan terakhir: ${shortLabelFor(last.planName) || last.planName} · ${dsl === 0 ? 'hari ini' : dsl === 1 ? 'kemarin' : dsl + ' hari lalu'}`
                    : 'Belum ada sesi — rotasi mulai dari Leg'}
                  {sug.isNightLight && ' · disarankan ringan (shift malam)'}
                </div>
                {!sugPlan ? (
                  <div className="small muted" style={{ marginBottom: 10 }}>
                    Plan {sugPreset?.name ?? sug.key} belum dibuat — atur lewat "Kelola jadwal" dulu.
                  </div>
                ) : (
                  sugPlan.items.map((it, i) => {
                    const ex = exercises.find((e) => e.id === it.exerciseId)
                    return (
                      <div className="row" key={i} style={{ padding: '5px 0' }}>
                        <span className="num">{i + 1}.</span>
                        <span className="grow">{ex?.name ?? 'Gerakan'}</span>
                        <span className="badge">
                          {it.targetSets} × {it.reps}{exerciseIsDuration(exercises, it.exerciseId) ? ' dtk' : ''}
                        </span>
                      </div>
                    )
                  })
                )}
                <div style={{ height: 10 }} />
                {restToday ? (
                  <button className="btn sm ghost wide" onClick={() => setRestToday(false)}>Batalkan istirahat</button>
                ) : (
                  <div className="action-row">
                    <button className="btn primary" onClick={handleStart}>
                      {sugPlan ? `Mulai ${sugPreset?.shortLabel ?? sugPlan.name}` : 'Buat plan dulu'}
                    </button>
                    <button className="btn ghost" onClick={() => setShowPick(true)}>Pilih plan lain</button>
                    <button className="btn ghost" onClick={() => setRestToday(true)}>Istirahat hari ini</button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">Rotasi <span className="badge accent">auto</span></div>
            <div className="flow">
              {rot.rotation.map((k, i) => (
                <Fragment key={k}>
                  {i > 0 && <span className="arr">→</span>}
                  <span className={'chip' + (k === sug.key ? ' next' : '') + (lastKey === k ? ' done' : '')}>
                    {presetByKey(k)?.shortLabel ?? k.toUpperCase()}
                  </span>
                </Fragment>
              ))}
            </div>
            <div className="small muted" style={{ marginTop: 8 }}>
              Urutan & target diatur di Pengaturan.
            </div>
          </div>

          {restToday && (
            <div className="card">
              <div className="card-title">
                <span>Hari ini istirahat</span>
                <span className="badge" style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--danger)' }}>REST</span>
              </div>
              <div className="small muted">
                Pulihkan otot, tidur cukup. Saran berikutnya tetap dihitung otomatis.
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <DayStrip days={days} base={base} sessions={sessions} plans={plans} />

          {todayPlan && !todayIsRest && todaySessions.length === 0 && (
            <div className="card">
              <div className="card-title">
                <span>Jadwal: {todayPlan.name}</span>
                <span className="badge accent">{DAY_NAMES[nowDow]}</span>
              </div>
              {todayPlan.items.map((it, i) => {
                const ex = exercises.find((e) => e.id === it.exerciseId)
                return (
                  <div className="row" key={i} style={{ padding: '6px 0' }}>
                    <span className="num">{i + 1}.</span>
                    <span className="grow">{ex?.name ?? 'Gerakan'}</span>
                    <span className="badge">{it.targetSets} × {it.reps}{exerciseIsDuration(exercises, it.exerciseId) ? ' dtk' : ''}</span>
                  </div>
                )
              })}
            </div>
          )}

          {todayIsRest && (
            <div className="card">
              <div className="card-title">
                <span>Hari ini istirahat</span>
                <span className="badge" style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--danger)' }}>REST</span>
              </div>
              <div className="small muted">
                Pulihkan otot, tidur cukup, dan minum air putih. Tidak ada jadwal latihan hari ini.
              </div>
            </div>
          )}
        </>
      )}

      <div className="row spread">
        <div className="card-title" style={{ marginTop: 6 }}>Sesi</div>
        <button className="btn sm ghost" onClick={() => setShowPlan(true)}>Kelola jadwal</button>
      </div>

      {!ready ? (
        <div className="empty">Memuat…</div>
      ) : (
        <>
          {todaySessions.length > 0 && (
            <div className="card">
              <div className="card-title">Sesi hari ini</div>
              {todaySessions.map((s) => (
                <div className="list-item" key={s.id}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.planName}</div>
                    <div className="small muted">
                      {s.sets.length} set · {s.endedAt ? 'Selesai' : 'Berjalan'}
                    </div>
                  </div>
                  <button className="btn sm accent" onClick={() => navigate(`/session/${s.id}`)}>
                    {s.endedAt ? 'Lihat' : 'Lanjut'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {showStart && (
            <button className="btn primary wide" onClick={handleStart}>
              {startLabel}
            </button>
          )}
        </>
      )}

      {showPlan && <PlanEditor onClose={() => setShowPlan(false)} />}

      {showPick && (
        <Modal onClose={() => setShowPick(false)} label="Pilih plan">
          <h3>Pilih plan untuk hari ini</h3>
          {pickOptions.length === 0 ? (
            <div className="small muted">Belum ada plan. Atur lewat "Kelola jadwal" dulu.</div>
          ) : (
            pickOptions.map((o) => (
              <button
                key={o.key}
                className={'opt' + (o.suggested ? ' suggested' : '')}
                onClick={() => { setShowPick(false); void createAndOpen(o.plan, o.name) }}
              >
                {o.name}{o.suggested && <span className="tag">saran</span>}
                <span className="sub">{o.sub}</span>
              </button>
            ))
          )}
          <div className="divider" />
          <button className="opt" onClick={() => { setShowPick(false); void createAndOpen(undefined, 'Sesi bebas') }}>
            Sesi bebas<span className="sub">Tanpa plan — isi manual</span>
          </button>
        </Modal>
      )}

      {showInstallGuide && (
        <Modal onClose={() => setShowInstallGuide(false)} label="Cara pasang aplikasi di iPhone">
            <h3>Pasang aplikasi di iPhone</h3>
            <div className="small muted" style={{ marginBottom: 10 }}>
              Di iPhone tidak ada tombol instal dari dalam aplikasi. Ikuti 3 langkah ini sekali saja:
            </div>
            {[
              ['Ketuk tombol Share', 'Tombol ⬆️ di bilah bawah Safari (ikon kotak dengan panah ke atas).'],
              ['Pilih "Add to Home Screen"', 'Gulir menu Share lalu ketuk "Add to Home Screen" (Tambah ke Layar Utama).'],
              ['Ketuk "Add"', 'Konfirmasi di kanan atas. Ikon Gym Tracker akan muncul di layar utama.'],
            ].map(([title, desc], i) => (
              <div className="row" key={i} style={{ padding: '6px 0', gap: 10 }}>
                <span className="badge accent" style={{ flex: 'none', minWidth: 26, textAlign: 'center' }}>{i + 1}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
                  <div className="small muted">{desc}</div>
                </div>
              </div>
            ))}
            <div className="form-actions">
              <button className="btn primary" onClick={() => setShowInstallGuide(false)}>Mengerti</button>
            </div>
        </Modal>
      )}

    </div>
  )
}
