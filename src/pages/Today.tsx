import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUid } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { DAY_NAMES, type WorkoutPlan, type PlanItem } from '../types'
import { todayKey, addDays, dayOfWeek } from '../lib/date'
import { buildSession, createSession, deleteSession, createExercise } from '../lib/gymstore'
import { shortLabelFor, isRest, presetByKey, presetByName, dotColorFor, PLAN_PRESETS, type PlanPreset } from '../lib/templates'
import { exerciseIsDuration } from '../lib/helpers'
import {
  rotationOf,
  suggestKey,
  planForKey,
  daysSinceLast,
  lastFinishedSession,
} from '../lib/rotation'
import { shiftForDate, SHIFT_LABELS, SHIFT_COLORS } from '../lib/shift'
import { computePosition, getFullLabel, getScheme, getPrescribedWeights, getSbdLiftForSession, suggestKey531, get531Sequence, computeExcludedTypes, dynamicCycleLength } from '../lib/progression'
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
  const { plans, exercises, sessions, settings, ready, showToast, saveSettings } = useData()
  const [showPlan, setShowPlan] = useState(false)
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [showPick, setShowPick] = useState(false)
  // Guard double-tap: satu sesi per tekan Mulai (Firestore await bisa >1 detik)
  const [creating, setCreating] = useState(false)

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
  const dsl = daysSinceLast(sessions, base)

  // ===== 5/3/1 =====
  const excludedTypes = computeExcludedTypes(settings)
  const cycleLen = dynamicCycleLength(excludedTypes)
  const cyclePos = computePosition(sessions, excludedTypes, settings.skippedSessions ?? 0)
  const cycleScheme = getScheme(cyclePos.sessionIndex, excludedTypes)
  const cycleLabel = getFullLabel(cyclePos.cycle, cyclePos.sessionIndex, excludedTypes)
  const cycleTM = settings.trainingMax
  const tmForLift = getSbdLiftForSession(cyclePos.sessionIndex, excludedTypes)
  const prescribed = cycleScheme && tmForLift && cycleTM ?
    getPrescribedWeights(cycleScheme, cycleTM[tmForLift] ?? 0) : []
  const prescribedSummary = prescribed.length > 0
    ? prescribed.map((p) => `${p.weight}kg×${p.reps}`).join(' · ') : ''

  // 5/3/1 aktif jika TM sudah diset (minimal satu lift > 0)
  const is531Active = !!(cycleTM && (cycleTM.squat > 0 || cycleTM.bench > 0 || cycleTM.deadlift > 0))
  const effectiveKey = is531Active ? suggestKey531(cyclePos.sessionIndex, excludedTypes) : sug.key
  const effectivePreset = presetByKey(effectiveKey)
  const effectivePlan = planForKey(plans, effectiveKey)

  const todaySessions = sessions.filter((s) => s.date === base)
  // Istirahat hari ini = ada sesi Rest Day tersimpan (bukan state lokal) —
  // sehingga muncul juga di kalender Riwayat & bertahan setelah reload.
  const restToday = todaySessions.some((s) => isRest(s.planName))
  const todayDone = todaySessions.some((s) => s.endedAt !== null && !isRest(s.planName))
  const activeSession = sessions.find((s) => s.date === base && s.endedAt === null && !isRest(s.planName))

  const todayPlan = plans.find((p) => p.dayOfWeek === nowDow)
  const todayIsRest = todayPlan ? isRest(todayPlan.name) : false

  // Semua preset (bukan hanya yang plan-nya sudah dibuat) — supaya Pull/Push/
  // Easy/Cardio selalu bisa dipilih walau belum diatur di "Kelola jadwal".
  // Rest Day dikecualikan (ada tombol "Istirahat hari ini").
  // Kalau plan belum dibuat, sesi tetap bisa dimulai dari template preset
  // (gerakan dicocokkan dengan library lewat templatePlan).
  const pickOptions = PLAN_PRESETS
    .filter((p) => p.key !== 'rest' && !(settings.excludeEasyDay && p.key === 'easy'))
    .map((p) => ({
      key: p.key,
      name: p.name,
      plan: planForKey(plans, p.key),
      suggested: p.key === effectiveKey,
      sub: planForKey(plans, p.key)
        ? `${planForKey(plans, p.key)!.items.length} gerakan`
        : `${p.exercises.length} gerakan (template)`,
    }))

  const showStart = rotationMode ? !restToday && !todayDone : !todayIsRest
  // CTA bawah hanya tampil saat kartu Saran (dengan tombol Mulai inline) tidak tampak —
  // hindari dua tombol Mulai serentak di satu layar.
  const showBottomStart = showStart && (!rotationMode || restToday)

  const startLabel = activeSession
    ? 'Lanjutkan sesi hari ini'
    : rotationMode
      ? effectivePlan
        ? `Mulai ${cycleLabel}`
        : 'Buat plan saran dulu'
      : todayPlan
        ? 'Mulai sesi hari ini'
        : 'Atur jadwal & mulai'

  // Plan virtual dari preset — dipakai saat plan belum dibuat di Kelola jadwal.
  // Gerakan preset dicocokkan dengan library; yang belum ada otomatis dibuat ke
  // library (supaya nama gerakan selalu bisa di-resolve untuk volume otot & riwayat).
  async function templatePlan(preset: PlanPreset): Promise<WorkoutPlan> {
    const items: PlanItem[] = []
    for (let i = 0; i < preset.exercises.length; i++) {
      const pe = preset.exercises[i]
      let ex = exercises.find((e) => e.name.trim().toLowerCase() === pe.name.trim().toLowerCase())
      if (!ex) {
        try {
          const ref = await createExercise(uid, {
            name: pe.name,
            muscleGroup: pe.muscleGroup,
            equipment: pe.equipment,
            category: preset.key,
          })
          ex = { id: ref.id, name: pe.name, muscleGroup: pe.muscleGroup, equipment: pe.equipment, category: preset.key }
        } catch {
          continue // gagal offline — lewati gerakan ini (best-effort)
        }
      }
      items.push({ exerciseId: ex.id, order: i, targetSets: 3, reps: 10, restSec: 60 })
    }
    return { id: '', name: preset.name, dayOfWeek: -1, items }
  }

  async function createAndOpen(plan: WorkoutPlan | undefined | null, name?: string) {
    if (creating) return
    setCreating(true)
    // Stiker ngikut plan yang dipilih: wave tetap dari siklus, nama ikut plan
    const chosenName = name ?? plan?.name ?? null
    const wave = getScheme(cyclePos.sessionIndex, excludedTypes)?.label ?? null
    const stikerName = chosenName ?? getFullLabel(cyclePos.cycle, cyclePos.sessionIndex, excludedTypes).replace(/^\[C\d+-S\d+\]\s*/, '')
    const snapLabel = `[C${cyclePos.cycle}-S${String(cyclePos.sessionIndex + 1).padStart(2, '0')}] ${stikerName}${wave ? ` — ${wave}` : ''}`
    const payload = buildSession(
      plan,
      base,
      (id) => (exerciseIsDuration(exercises, id) ? 'duration' : 'reps'),
      Date.now(),
      { cycle: cyclePos.cycle, sessionIndex: cyclePos.sessionIndex, cycleLabel: snapLabel, scheme: wave ?? undefined },
    )
    if (chosenName) payload.planName = chosenName
    try {
      const ref = await createSession(uid, payload)
      navigate(`/session/${ref.id}`)
    } catch {
      showToast('Gagal membuat sesi — cek koneksi internet', 'error')
    } finally {
      setCreating(false)
    }
  }

  function handleStart() {
    if (creating) return
    if (activeSession) {
      navigate(`/session/${activeSession.id}`)
      return
    }
    if (rotationMode) {
      if (!effectivePlan) {
        setShowPlan(true)
        return
      }
      void createAndOpen(effectivePlan, cycleLabel)
      return
    }
    if (todayPlan && !todayIsRest) {
      void createAndOpen(todayPlan)
    } else {
      setShowPlan(true)
    }
  }

  async function handleSkip() {
    try {
      await saveSettings({ skippedSessions: (settings.skippedSessions ?? 0) + 1 })
      showToast(`${effectivePreset?.shortLabel ?? effectiveKey} dilewati → lanjut ke sesi berikutnya`)
    } catch {
      showToast('Gagal skip — cek koneksi internet', 'error')
    }
  }

  async function handleUndoSkip() {
    const n = settings.skippedSessions ?? 0
    if (n <= 0) return
    try {
      await saveSettings({ skippedSessions: n - 1 })
      showToast('Skip dikembalikan — posisi mundur 1')
    } catch {
      showToast('Gagal mengembalikan skip', 'error')
    }
  }

  // Simpan sesi Rest Day — tersimpan di Firestore, muncul di kalender Riwayat
  async function markRestToday() {
    try {
      await createSession(uid, {
        date: base,
        planId: null,
        planName: 'Rest Day',
        note: '',
        startedAt: Date.now(),
        endedAt: Date.now(),
        sets: [],
      })
    } catch {
      showToast('Gagal menyimpan istirahat — cek koneksi internet', 'error')
    }
  }

  // Batalkan istirahat — hapus sesi Rest Day hari ini
  async function cancelRestToday() {
    const rest = todaySessions.find((s) => isRest(s.planName))
    if (!rest) return
    try {
      await deleteSession(uid, rest.id)
    } catch {
      showToast('Gagal membatalkan istirahat — cek koneksi internet', 'error')
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
                  Sesi berikutnya: {getFullLabel(cyclePos.cycle, cyclePos.sessionIndex, excludedTypes)} — {presetByKey(suggestKey531(cyclePos.sessionIndex, excludedTypes))?.shortLabel ?? ''}
                </div>
                <div style={{ height: 10 }} />
                <button className="btn sm ghost wide" onClick={() => setShowPick(true)}>Tambah sesi lagi</button>
              </>
            ) : (
              <>
                <div className="suggest-big">
                  <span className="dot" style={{ background: effectivePlan ? dotColorFor(effectivePlan.name) : 'var(--accent)' }} />
                  <span className="name">{effectivePreset?.shortLabel ?? effectiveKey.toUpperCase()}</span>
                </div>
                <div className="small" style={{ fontWeight: 800, marginBottom: 2 }}>
                  {cycleLabel}
                </div>
                {prescribedSummary && (
                  <div className="small muted" style={{ marginBottom: 4 }}>
                    {cycleScheme?.label} · {tmForLift && cycleTM ? `${tmForLift.charAt(0).toUpperCase() + tmForLift.slice(1)} TM ${cycleTM[tmForLift]}kg` : ''} · {prescribedSummary}
                  </div>
                )}
                <div className="suggest-meta">
                  {last
                    ? `Latihan terakhir: ${shortLabelFor(last.planName) || last.planName} · ${dsl === 0 ? 'hari ini' : dsl === 1 ? 'kemarin' : dsl + ' hari lalu'}`
                    : 'Belum ada sesi — rotasi mulai dari Leg'}
                  {sug.isNightLight && ' · disarankan ringan (shift malam)'}
                </div>
                {!effectivePlan ? (
                  <div className="small muted" style={{ marginBottom: 10 }}>
                    Plan {effectivePreset?.name ?? effectiveKey} belum dibuat — atur lewat "Kelola jadwal" dulu.
                  </div>
                ) : (
                  effectivePlan.items.map((it, i) => {
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
                  <button className="btn sm ghost wide" onClick={() => void cancelRestToday()}>Batalkan istirahat</button>
                ) : (
                  <>
                    <div className="action-row">
                      <button className="btn primary" disabled={creating} onClick={handleStart}>
                        {effectivePlan ? `Mulai ${cycleLabel}` : 'Buat plan dulu'}
                      </button>
                      <button className="btn ghost" onClick={() => setShowPick(true)}>Pilih plan lain</button>
                      <button className="btn ghost" onClick={() => void markRestToday()}>Istirahat</button>
                      <button className="btn ghost" onClick={() => void handleSkip()}>Skip</button>
                    </div>
                    {(settings.skippedSessions ?? 0) > 0 && (
                      <button className="btn sm ghost wide" onClick={() => void handleUndoSkip()} style={{ marginTop: 6 }}>
                        ↩ Kembalikan skip terakhir ({settings.skippedSessions} di-skip)
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              {is531Active ? (
                <>Urutan 5/3/1 <span className="badge accent">C{cyclePos.cycle}</span> <span className="badge">{cycleLen} sesi</span></>
              ) : (
                <>Rotasi <span className="badge accent">auto</span></>
              )}
            </div>
            {is531Active ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {get531Sequence(excludedTypes).map((s, i) => {
                    const isCurrent = i === cyclePos.sessionIndex
                    const isDone = i < cyclePos.sessionIndex
                    const weekLabel = i < 4 ? '3×5' : i < 8 ? '3×3' : i < 12 ? '5/3/1' : 'Deload'
                    return (
                      <div
                        key={i}
                        className={'shift-week-cell' + (isCurrent ? ' today' : '')}
                        style={
                          isCurrent
                            ? { borderColor: 'var(--accent)', background: 'rgba(99,102,241,0.1)' }
                            : isDone
                              ? { opacity: 0.4 }
                              : undefined
                        }
                      >
                        <div className="sw-dow" style={{ fontSize: 10 }}>
                          {weekLabel}
                        </div>
                        <div className="sw-dnum" style={{ fontSize: 11 }}>
                          S{i + 1}
                        </div>
                        <span
                          className="sw-shift"
                          style={{
                            background:
                              s.key === 'leg'
                                ? '#6366f1'
                                : s.key === 'push'
                                  ? '#f59e0b'
                                  : s.key === 'pull'
                                    ? '#10b981'
                                    : '#6b7280',
                            fontSize: 10,
                            padding: '1px 4px',
                          }}
                        >
                          {s.key === 'leg' ? 'L' : s.key === 'push' ? 'P' : s.key === 'pull' ? 'Pl' : 'E'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="small muted" style={{ marginTop: 8 }}>
                  1 cycle = {cycleLen} sesi · S{cyclePos.sessionIndex + 1} = sesi saat ini
                </div>
              </>
            ) : (
              <>
                <div className="flow">
                  {rot.rotation.map((k, i) => (
                    <Fragment key={k}>
                      {i > 0 && <span className="arr">→</span>}
                      <span className={'chip' + (k === effectiveKey ? ' next' : '') + (lastKey === k ? ' done' : '')}>
                        {presetByKey(k)?.shortLabel ?? k.toUpperCase()}
                      </span>
                    </Fragment>
                  ))}
                </div>
                <div className="small muted" style={{ marginTop: 8 }}>
                  Urutan rotasi diatur di Pengaturan.
                </div>
              </>
            )}
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

      {!ready ? (
        <div className="empty">Memuat…</div>
      ) : (
        <>
          {showBottomStart && (
            <button className="btn primary wide" disabled={creating} onClick={handleStart}>
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
                onClick={async () => {
                  setShowPick(false)
                  const preset = PLAN_PRESETS.find((p) => p.key === o.key)!
                  const plan = o.plan ?? (await templatePlan(preset))
                  void createAndOpen(plan, o.name)
                }}
              >
                {o.name}{o.suggested && <span className="tag">saran</span>}
                <span className="sub">{o.sub}</span>
              </button>
            ))
          )}
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
