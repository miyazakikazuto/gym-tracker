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
  upsertBodyweight,
  deleteBodyweight,
  patchExerciseCategory,
} from '../lib/gymstore'
import { categoryOfExercise } from '../lib/helpers'
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

  const showToast = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    if (!uid) return
    setReady(false)
    const unsubs = [
      subscribeExercises(uid, setExercises),
      subscribePlans(uid, setPlans),
      subscribeSessions(uid, setSessions),
      subscribeBodyweights(uid, setBodyweights),
      subscribeSettings(uid, setSettings),
    ]
    const t = setTimeout(() => setReady(true), 800)
    return () => {
      unsubs.forEach((u) => u())
      clearTimeout(t)
    }
  }, [uid])

  // Migrasi sekali jalan: gerakan lama tanpa kategori diberi kategori dari grup otot
  useEffect(() => {
    if (!uid || exercises.length === 0) return
    const missing = exercises.filter((e) => !e.category)
    if (missing.length === 0) return
    for (const e of missing) {
      const cat = categoryOfExercise(e)
      if (cat !== e.category) {
        patchExerciseCategory(uid, e.id, cat).catch(() => undefined)
      }
    }
  }, [uid, exercises])

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