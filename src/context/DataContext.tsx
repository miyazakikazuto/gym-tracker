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
  showToast: (msg: string) => void
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
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  // True setelah snapshot exercises datang dari SERVER Firestore (bukan cache).
  // Seed default menunggu flag ini supaya tidak dobel saat internet lambat:
  // tanpa ini, seed bisa jalan dari cache kosong lalu data asli datang belakangan.
  const exercisesFromServerRef = useRef(false)
  const [exercisesFromServer, setExercisesFromServer] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
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
    patchExerciseCategories(uid, entries).catch(() => undefined)
  }, [uid, exercises])

  // Seed default exercises untuk akun baru (0 exercises, 0 sessions).
  // Idempoten & aman race: hanya jalan setelah data konfirmasi dari SERVER —
  // bukan sekadar cache lokal yang belum terisi (internet lambat / storage bersih).
  const seededRef = useRef(false)
  useEffect(() => {
    if (!uid || !ready || !exercisesFromServer || seededRef.current) return
    if (exercises.length > 0 || sessions.length > 0) return
    seededRef.current = true
    for (const ex of DEFAULT_EXERCISES) {
      createExercise(uid, ex).catch(() => undefined)
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
      updateSession(uid, s.id, { endedAt: s.startedAt + 90 * 60 * 1000 }).catch(() => undefined)
    }
  }, [uid, sessions])

  const saveBodyweight = (date: string, kg: number) => {
    if (!uid) return Promise.resolve()
    return upsertBodyweight(uid, date, kg)
  }

  const removeBodyweight = (date: string) => {
    if (!uid) return
    deleteBodyweight(uid, date).catch(() => showToast('Gagal menghapus — cek koneksi internet'))
  }

  const saveSettings = (patch: Partial<UserSettings>) => {
    if (!uid) return
    updateSettings(uid, patch).catch(() => showToast('Gagal menyimpan — cek koneksi internet'))
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
        <div className="toast" role="alert">
          {toast}
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