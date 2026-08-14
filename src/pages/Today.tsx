import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { updatePassword } from 'firebase/auth'
import { useAuth, useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { getAuthInstance } from '../lib/firebase'
import { DAY_NAMES, type WorkoutPlan } from '../types'
import { todayKey, addDays, dayOfWeek } from '../lib/date'
import { buildSession, createSession } from '../lib/gymstore'
import { shortLabelFor, isRest } from '../lib/templates'
import { exerciseIsDuration } from '../lib/helpers'
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
  const { plans, exercises, sessions, ready } = useData()
  const [showPlan, setShowPlan] = useState(false)
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState('')

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

  const todayPlan = plans.find((p) => p.dayOfWeek === nowDow)
  const todayIsRest = todayPlan ? isRest(todayPlan.name) : false
  const todaySessions = sessions.filter((s) => s.date === base)
  const activeSession = sessions.find((s) => s.date === base && s.endedAt === null)

  async function createAndOpen(plan: WorkoutPlan | undefined | null) {
    const ref = await createSession(
      uid,
      buildSession(plan, base, (id) => (exerciseIsDuration(exercises, id) ? 'duration' : 'reps'), Date.now()),
    )
    navigate(`/session/${ref.id}`)
  }

  function handleStart() {
    if (activeSession) {
      navigate(`/session/${activeSession.id}`)
      return
    }
    if (todayPlan && !todayIsRest) {
      void createAndOpen(todayPlan)
    } else {
      setShowPlan(true)
    }
  }

  async function savePassword() {
    setPwMsg('')
    if (pw1.length < 6) {
      setPwMsg('Sandi minimal 6 karakter.')
      return
    }
    if (pw1 !== pw2) {
      setPwMsg('Sandi tidak sama.')
      return
    }
    setPwBusy(true)
    try {
      const cur = getAuthInstance().currentUser
      if (!cur) throw new Error('Sesi berakhir. Login ulang dulu.')
      await updatePassword(cur, pw1)
      setShowPw(false)
      setPw1('')
      setPw2('')
      setPwMsg('Sandi tersimpan. Sekarang bisa login dengan email + sandi di semua perangkat.')
    } catch (e) {
      setPwMsg(msgOf(e))
    } finally {
      setPwBusy(false)
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
          <button className="icon-btn" title="Atur kata sandi" aria-label="Atur kata sandi" onClick={() => { setPwMsg(''); setShowPw(true) }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>
          <button className="icon-btn" title="Logout" aria-label="Keluar" onClick={() => getAuthInstance().signOut()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {pwMsg && (
        <div className="card" style={{ padding: 10, marginTop: 6 }}>
          <div className="small">{pwMsg}</div>
        </div>
      )}

      <DayStrip days={days} base={base} sessions={sessions} plans={plans} />

      <div className="row spread">
        <div className="card-title" style={{ marginTop: 6 }}>Sesi</div>
        <button className="btn sm ghost" onClick={() => setShowPlan(true)}>Kelola jadwal</button>
      </div>

      {!ready ? (
        <div className="empty">Memuat…</div>
      ) : (
        <>
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

          {!todayIsRest && (
            <button className="btn primary wide" onClick={handleStart}>
              {activeSession
                ? 'Lanjutkan sesi hari ini'
                : todayPlan
                  ? 'Mulai sesi hari ini'
                  : 'Atur jadwal & mulai'}
            </button>
          )}
        </>
      )}

      {showPlan && <PlanEditor onClose={() => setShowPlan(false)} />}

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

      {showPw && (
        <Modal onClose={() => setShowPw(false)} label="Atur kata sandi">
            <h3>Atur kata sandi</h3>
            <div className="small muted" style={{ marginBottom: 10 }}>
              Pakai email <b>{user?.email}</b> + sandi ini untuk login di semua perangkat (termasuk iPhone) — tanpa perlu Google.
            </div>
            <input className="input" type="password" autoComplete="new-password" placeholder="Sandi baru (min. 6 karakter)"
              value={pw1} onChange={(e) => setPw1(e.target.value)} disabled={pwBusy} />
            <input className="input" type="password" autoComplete="new-password" placeholder="Ulangi sandi"
              value={pw2} onChange={(e) => setPw2(e.target.value)} disabled={pwBusy} />
            {pwMsg && <div className="auth-error" style={{ marginTop: 8 }}>{pwMsg}</div>}
            <div className="form-actions">
              <button className="btn ghost" onClick={() => setShowPw(false)} disabled={pwBusy}>Batal</button>
              <button className="btn primary" onClick={() => void savePassword()} disabled={pwBusy}>
                {pwBusy ? 'Menyimpan…' : 'Simpan sandi'}
              </button>
            </div>
        </Modal>
      )}
    </div>
  )
}

function msgOf(err: unknown): string {
  const m = (err as { message?: string }).message
  if (!m) return 'Terjadi kesalahan. Coba lagi.'
  return m.replace(/^Firebase: /, '').replace(/ \(.*\)\.$/, '')
}