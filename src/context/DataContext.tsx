import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeExercises,
  subscribePlans,
  subscribeSessions,
  subscribeBodyweights,
  subscribeSettings,
  updateSettings,
  updateSession,
  upsertBodyweight,
  deleteBodyweight,
  patchExerciseCategories,
} from '../lib/gymstore'
import { categoryOfExercise, isCountedSession, renumberExerciseSets } from '../lib/helpers'
import { presetByLooseName, presetByName, stripSticker, newNameForOldPlan } from '../lib/templates'
import { todayKey } from '../lib/date'
import { DEFAULT_EXERCISES } from '../lib/defaults'
import type { Exercise, WorkoutPlan, Session, SessionSet, Bodyweight, UserSettings } from '../types'

interface DataState {
  exercises: Exercise[]
  plans: WorkoutPlan[]
  sessions: Session[]
  bodyweights: Bodyweight[]
  settings: Partial<UserSettings>
  ready: boolean
  setExercises: React.Dispatch<React.SetStateAction<Exercise[]>>
  setPlans: React.Dispatch<React.SetStateAction<WorkoutPlan[]>>
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>
  saveBodyweight: (date: string, kg: number) => Promise<void>
  removeBodyweight: (date: string) => void
  saveSettings: (patch: Partial<UserSettings>) => void
  showToast: (msg: string, kind?: 'ok' | 'error') => void
}

const DataContext = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [bodyweights, setBodyweights] = useState<Bodyweight[]>([])
  const [settings, setSettings] = useState<Partial<UserSettings>>({})
  const [ready, setReady] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'error' } | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  // True setelah snapshot exercises datang dari SERVER Firestore (bukan cache).
  // Seed default menunggu flag ini supaya tidak dobel saat internet lambat:
  // tanpa ini, seed bisa jalan dari cache kosong lalu data asli datang belakangan.
  const exercisesFromServerRef = useRef(false)
  const [exercisesFromServer, setExercisesFromServer] = useState(false)

  const showToast = (msg: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ msg, kind })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    if (!uid) return
    setReady(false)
    exercisesFromServerRef.current = false
    setExercisesFromServer(false)
    // ready = true setelah snapshot PERTAMA dari kelima subscription tiba
    // (bukan timer fix) — UI tidak tampil sebelum data benar-benar terisi.
    let remaining = 5
    const markFirst = () => {
      remaining -= 1
      if (remaining === 0) setReady(true)
    }
    const wrapFirst = <A extends unknown[]>(cb: (...args: A) => void) => {
      let first = true
      return (...args: A) => {
        if (first) {
          first = false
          markFirst()
        }
        cb(...args)
      }
    }
    const unsubs = [
      subscribeExercises(
        uid,
        wrapFirst((list: Exercise[], meta?: { fromServer: boolean }) => {
          if (meta?.fromServer && !exercisesFromServerRef.current) {
            exercisesFromServerRef.current = true
            setExercisesFromServer(true)
          }
          setExercises(list)
        }),
      ),
      subscribePlans(uid, wrapFirst(setPlans)),
      subscribeSessions(uid, wrapFirst(setSessions)),
      subscribeBodyweights(uid, wrapFirst(setBodyweights)),
      subscribeSettings(uid, wrapFirst(setSettings)),
    ]
    // Safety-net: kalau ada subscription yang tak kunjung memanggil balik
    // (mis. jaringan diblokir total), tetap tandai siap setelah 5 detik.
    const t = setTimeout(() => {
      if (remaining > 0) console.warn('[DataContext] ready safety-net triggered — remaining:', remaining)
      setReady(true)
    }, 5000)
    return () => {
      unsubs.forEach((u) => u())
      clearTimeout(t)
    }
  }, [uid])

  // Migrasi sekali jalan: gerakan lama tanpa kategori diberi kategori dari grup otot
  useEffect(() => {
    if (!uid || exercises.length === 0) return
    const entries = exercises
      .filter((e) => !e.category)
      .map((e) => ({ id: e.id, category: categoryOfExercise(e) }))
    if (entries.length === 0) return
    patchExerciseCategories(uid, entries).catch((err) => {
      console.warn('[DataContext] migrasi kategori gagal:', err)
      showToast('Migrasi kategori gagal — coba lagi', 'error')
    })
  }, [uid, exercises])

  // Migrasi stiker cycle yang salah tempel (mis. Lower ditempel Upper)
  // + normalisasi planName berstiker ("[C1-S01] Leg Day — 3×5" → "Lower").
  // Idempoten: sesi yang sudah polos & labelnya sudah benar tidak ditulis
  // ulang — sebelumnya perbandingan pakai planName mentah berstiker, jadi
  // semua sesi dari tombol Mulai selalu dianggap mismatch di tiap load.
  const cycleMigratingRef = useRef(false)
  useEffect(() => {
    if (!uid || !ready || sessions.length === 0 || cycleMigratingRef.current) return
    // Nama kanonis: preset yang cocok (longgar) atau hasil kupas stiker.
    // "Push" dari label siklus lama → preset "Arm & Shoulder" lewat presetByLooseName.
    const canonicalName = (name: string): string => {
      const preset = presetByLooseName(name) ?? presetByName(name)
      return preset?.name ?? stripSticker(name)
    }
    const mismatched = sessions.filter((s) => {
      const barePlan = canonicalName(s.planName)
      if (barePlan !== s.planName) return true // planName berstiker
      if (!s.cycleLabel) return false
      const labelPlan = canonicalName(s.cycleLabel)
      const labelPrefix = s.cycleLabel.replace(/^\[(C|R)\d+-S\d+\]\s*/, '')
      // Label ganda: prefix masih berstiker setelah satu kali kupas.
      if (/^\[(C|R)\d+-S\d+\]/.test(labelPrefix)) return true
      return labelPlan !== barePlan
    })
    if (mismatched.length === 0) return
    cycleMigratingRef.current = true
    import('../lib/progression').then(({ computePosition, getScheme, computeExcludedTypes }) => {
      import('firebase/firestore').then(({ writeBatch, doc }) => {
        import('../lib/db').then(({ getDb }) => {
          const db = getDb()
          const batch = writeBatch(db)
          let count = 0
          for (const s of mismatched) {
            const before = sessions.filter(
              (x) => isCountedSession(x) && (x.date < s.date || (x.date === s.date && x.startedAt < s.startedAt)),
            )
            try {
              const barePlan = canonicalName(s.planName)
              // Tanpa cycleLabel (mis. sesi extra) jangan karang label baru —
              // cukup normalisasi planName-nya saja.
              if (!s.cycleLabel) {
                if (barePlan !== s.planName) {
                  batch.update(doc(db, 'users', uid, 'sessions', s.id), { planName: barePlan } as object)
                  count++
                }
                continue
              }
              const ex = computeExcludedTypes(settings)
              const pos = computePosition(before, ex, settings.skippedSessions ?? 0)
              const wave = getScheme(pos.sessionIndex, ex)?.label ?? s.scheme
              const correctLabel = `[C${pos.cycle}-S${String(pos.sessionIndex + 1).padStart(2, '0')}] ${barePlan}${wave ? ` — ${wave}` : ''}`
              // Skip bila hasil hitung sama dengan yang tersimpan — jangan tulis ulang.
              if (correctLabel === s.cycleLabel && barePlan === s.planName) continue
              const fields: Record<string, unknown> = { cycleLabel: correctLabel, cycle: pos.cycle, sessionIndex: pos.sessionIndex }
              if (wave) fields.scheme = wave
              if (barePlan !== s.planName) fields.planName = barePlan
              batch.update(doc(db, 'users', uid, 'sessions', s.id), fields as object)
              count++
            } catch { /* ignore */ }
          }
          if (count > 0) {
            batch.commit()
              .then(() => { cycleMigratingRef.current = false })
              .catch((err: unknown) => {
                console.warn('[DataContext] patch cycleLabel gagal:', err)
                cycleMigratingRef.current = false
              })
          } else {
            cycleMigratingRef.current = false
          }
        })
      })
    })
  }, [uid, ready, sessions, settings])

  // Migrasi sekali jalan: nomor set yang bolong (mis. 2,3,4 karena set #1
  // pernah dihapus sebelum ada perapian) dinomori ulang 1..n per gerakan.
  // Idempoten: sesi yang nomornya sudah rapat tidak ditulis ulang, jadi
  // data lama membaik sendiri tanpa input ulang.
  const setRenumberRef = useRef(false)
  useEffect(() => {
    if (!uid || !ready || sessions.length === 0 || setRenumberRef.current) return
    const mismatched: { id: string; sets: SessionSet[] }[] = []
    for (const s of sessions) {
      let fixed = s.sets
      for (const ex of [...new Set(s.sets.map((x) => x.exerciseId))]) {
        fixed = renumberExerciseSets(fixed, ex)
      }
      if (JSON.stringify(fixed) !== JSON.stringify(s.sets)) mismatched.push({ id: s.id, sets: fixed })
    }
    if (mismatched.length === 0) return
    setRenumberRef.current = true
    void (async () => {
      try {
        for (const m of mismatched) {
          await updateSession(uid, m.id, { sets: m.sets })
        }
      } catch (err) {
        console.warn('[DataContext] migrasi nomor set gagal:', err)
        showToast('Perapian nomor set gagal — coba lagi', 'error')
      } finally {
        setRenumberRef.current = false
      }
    })()
  }, [uid, ready, sessions])

  // Migrasi nama plan lama → nama baru (rename split 23 Nov 2026):
  // plan "Leg Day" jadi "Lower", "Push Day" → "Arm & Shoulder", dst.
  // Sekali jalan + idempoten; skip bila nama baru sudah dipakai plan lain
  // (mis. user sudah bikin "Lower" sendiri) supaya tidak duplikat.
  const planRenameRef = useRef(false)
  useEffect(() => {
    if (!uid || !ready || plans.length === 0 || planRenameRef.current) return
    const names = new Set(plans.map((p) => p.name))
    const targets = plans.filter((p) => {
      const next = newNameForOldPlan(p.name)
      return next !== undefined && next !== p.name && !names.has(next)
    })
    if (targets.length === 0) return
    planRenameRef.current = true
    void (async () => {
      try {
        const { updatePlan } = await import('../lib/gymstore')
        for (const p of targets) {
          const next = newNameForOldPlan(p.name)
          if (!next) continue
          const { id, ...rest } = p
          await updatePlan(uid, id, { ...rest, name: next })
        }
        showToast(`Plan diganti nama: ${targets.map((p) => `${p.name} → ${newNameForOldPlan(p.name)}`).join(', ')}`)
      } catch (err) {
        console.warn('[DataContext] migrasi nama plan gagal:', err)
        planRenameRef.current = false
      }
    })()
  }, [uid, ready, plans])

  // Sinkronisasi gerakan preset baru ke akun lama (sekali jalan):
  // seed hanya untuk akun kosong + templatePlan di-bypass bila plan sudah ada,
  // jadi preset baru (Jalan Kaki, Isometrik Quad, unilateral kanan) tidak pernah
  // masuk library lama. Sync ini cuma TAMBAH yang hilang via 1 batch.
  const syncedRef = useRef(false)
  useEffect(() => {
    if (!uid || !ready || !exercisesFromServer || syncedRef.current) return
    if (exercises.length === 0 && sessions.length === 0) return // akun baru → seed yang urus
    syncedRef.current = true
    void (async () => {
      try {
        const { syncPresetExercises } = await import('../lib/gymstore')
        const n = await syncPresetExercises(uid, exercises)
        if (n > 0) showToast(`${n} gerakan baru ditambahkan ke library`)
      } catch (err) {
        console.warn('[DataContext] sync preset gagal:', err)
        syncedRef.current = false
      }
    })()
  }, [uid, ready, exercisesFromServer, exercises, sessions.length])

  // Seed default exercises untuk akun baru (0 exercises, 0 sessions).
  // Idempoten & aman race: hanya jalan setelah data konfirmasi dari SERVER —
  // bukan sekadar cache lokal yang belum terisi (internet lambat / storage bersih).
  // Batch 49 writes jadi 1 commit — jauh lebih cepat & atomik per batch.
  const seededRef = useRef(false)
  useEffect(() => {
    if (!uid || !ready || !exercisesFromServer || seededRef.current) return
    if (exercises.length > 0 || sessions.length > 0) return
    seededRef.current = true
    void (async () => {
      try {
        const { getDb } = await import('../lib/db')
        const { writeBatch, collection, doc } = await import('firebase/firestore')
        const db = getDb()
        const batch = writeBatch(db)
        for (const ex of DEFAULT_EXERCISES) {
          const ref = doc(collection(db, 'users', uid, 'exercises'))
          batch.set(ref, ex)
        }
        await batch.commit()
      } catch (err) {
        console.warn('[DataContext] seed batch gagal:', err)
        seededRef.current = false
        showToast('Gagal seed gerakan default — coba lagi', 'error')
      }
    })()
  }, [uid, ready, exercisesFromServer, exercises.length, sessions.length])

  // Migrasi freeOrder Week-13 → Week-1: yang sudah ON tapi tanpa jangkar → set since/offset biar Week-1
  useEffect(() => {
    if (!uid || !ready || !settings.freeOrder || settings.freeOrderSince) return
    const cnt = sessions.filter((s) => isCountedSession(s)).length
    saveSettings({ freeOrderSince: todayKey(), freeOrderOffset: cnt } as Partial<UserSettings>)
  }, [uid, ready, settings.freeOrder, settings.freeOrderSince, sessions])

  // Auto-close: sesi berjalan yang ditinggalkan (>48 jam) ditandai selesai.
  // Idempoten & best-effort (sama seperti migrasi kategori): kalau gagal,
  // ditulis ulang saat load berikutnya. endedAt = startedAt + 90 menit (estimasi
  // durasi latihan) supaya data yang sudah dikerjakan tetap terhitung di statistik
  // (DOTS, Progress) — konsisten dengan aturan "hitung sesi selesai saja".
  useEffect(() => {
    if (!uid || sessions.length === 0) return
    const stale = sessions.filter((s) => s.endedAt === null && Date.now() - s.startedAt > 48 * 60 * 60 * 1000)
    if (stale.length === 0) return
    for (const s of stale) {
      updateSession(uid, s.id, { endedAt: s.startedAt + 90 * 60 * 1000 }).catch((err) => {
        console.warn('[DataContext] auto-close gagal:', s.id, err)
      })
    }
  }, [uid, sessions])

  const saveBodyweight = (date: string, kg: number) => {
    if (!uid) return Promise.resolve()
    return upsertBodyweight(uid, date, kg)
  }

  const removeBodyweight = (date: string) => {
    if (!uid) return
    deleteBodyweight(uid, date).catch(() => showToast('Gagal menghapus — cek koneksi internet', 'error'))
  }

  const saveSettings = (patch: Partial<UserSettings>) => {
    if (!uid) return
    updateSettings(uid, patch).catch(() => showToast('Gagal menyimpan — cek koneksi internet', 'error'))
  }

  return (
    <DataContext.Provider
      value={{
        exercises,
        plans,
        sessions,
        bodyweights,
        settings,
        ready,
        setExercises,
        setPlans,
        setSessions,
        saveBodyweight,
        removeBodyweight,
        saveSettings,
        showToast,
      }}
    >
      {children}
      {toast && (
        <div className={`toast ${toast.kind}`} role="alert">
          {toast.msg}
        </div>
      )}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData outside DataProvider')
  return ctx
}