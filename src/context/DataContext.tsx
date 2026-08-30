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
  createExercise,
} from '../lib/gymstore'
import { categoryOfExercise } from '../lib/helpers'
import { DEFAULT_EXERCISES } from '../lib/defaults'
import type { Exercise, WorkoutPlan, Session, Bodyweight, UserSettings } from '../types'

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
    const t = setTimeout(() => setReady(true), 5000)
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

  // Migrasi sekali jalan: benerin stiker cycle yang salah tempel (mis. Leg Day ditempel Easy Day)
  const cycleMigratedRef = useRef(false)
  useEffect(() => {
    if (!uid || !ready || sessions.length === 0 || cycleMigratedRef.current) return
    // Exact: "[C?-S??] Nama Plan" harus diakhiri planName, bukan substring includes (Leg vs Leg Press)
    const mismatched = sessions.filter((s) => {
      if (!s.cycleLabel) return false
      const labelPlan = s.cycleLabel.replace(/^\[C\d+-S\d+\]\s*/, '').split(' — ')[0]?.trim().toLowerCase()
      return labelPlan !== s.planName.trim().toLowerCase()
    })
    if (mismatched.length === 0) return
    cycleMigratedRef.current = true
    import('../lib/progression').then(({ computePosition, getScheme, computeExcludedTypes }) => {
      import('firebase/firestore').then(({ writeBatch, doc }) => {
        import('../lib/db').then(({ getDb }) => {
          const db = getDb()
          const batch = writeBatch(db)
          let count = 0
          for (const s of mismatched) {
            const before = sessions.filter(
              (x) => x.endedAt !== null && !x.isExtra && (x.date < s.date || (x.date === s.date && x.startedAt < s.startedAt)),
            )
            try {
              const ex = computeExcludedTypes(settings)
              const pos = computePosition(before, ex, settings.skippedSessions ?? 0)
              const wave = getScheme(pos.sessionIndex, ex)?.label ?? s.scheme
              const correctLabel = `[C${pos.cycle}-S${String(pos.sessionIndex + 1).padStart(2, '0')}] ${s.planName}${wave ? ` — ${wave}` : ''}`
              const fields: Record<string, unknown> = { cycleLabel: correctLabel, cycle: pos.cycle, sessionIndex: pos.sessionIndex }
              if (wave) fields.scheme = wave
              batch.update(doc(db, 'users', uid, 'sessions', s.id), fields as object)
              count++
            } catch { /* ignore */ }
          }
          if (count > 0) {
            batch.commit().catch((err: unknown) => {
              console.warn('[DataContext] patch cycleLabel gagal:', err)
              cycleMigratedRef.current = false
            })
          } else {
            cycleMigratedRef.current = false
          }
        })
      })
    })
  }, [uid, ready, sessions, settings])

  // Seed default exercises untuk akun baru (0 exercises, 0 sessions).
  // Idempoten & aman race: hanya jalan setelah data konfirmasi dari SERVER —
  // bukan sekadar cache lokal yang belum terisi (internet lambat / storage bersih).
  const seededRef = useRef(false)
  useEffect(() => {
    if (!uid || !ready || !exercisesFromServer || seededRef.current) return
    if (exercises.length > 0 || sessions.length > 0) return
    seededRef.current = true
    for (const ex of DEFAULT_EXERCISES) {
      createExercise(uid, ex).catch((err) => {
        console.warn('[DataContext] seed gagal:', ex.name, err)
        seededRef.current = false
        showToast('Gagal seed gerakan default — coba lagi', 'error')
      })
    }
  }, [uid, ready, exercisesFromServer, exercises.length, sessions.length])

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