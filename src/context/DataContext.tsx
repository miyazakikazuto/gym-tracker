import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getDoc } from 'firebase/firestore'
import { useAuth } from './AuthContext'
import {
  subscribeExercises,
  subscribePlans,
  subscribeSessions,
  subscribeBodyweights,
  upsertBodyweight,
  deleteBodyweight,
  patchExerciseCategory,
  profileRef,
} from '../lib/gymstore'
import { categoryOfExercise } from '../lib/helpers'
import { todayKey } from '../lib/date'
import type { Exercise, WorkoutPlan, Session, Bodyweight } from '../types'

interface DataState {
  exercises: Exercise[]
  plans: WorkoutPlan[]
  sessions: Session[]
  bodyweights: Bodyweight[]
  ready: boolean
  setExercises: React.Dispatch<React.SetStateAction<Exercise[]>>
  setPlans: React.Dispatch<React.SetStateAction<WorkoutPlan[]>>
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>
  saveBodyweight: (date: string, kg: number) => void
  removeBodyweight: (date: string) => void
}

const DataContext = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [bodyweights, setBodyweights] = useState<Bodyweight[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!uid) return
    setReady(false)
    const unsubs = [
      subscribeExercises(uid, setExercises),
      subscribePlans(uid, setPlans),
      subscribeSessions(uid, setSessions),
      subscribeBodyweights(uid, setBodyweights),
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

  // Migrasi sekali jalan: profile.bodyweightKg (versi lama) → entri log hari ini
  useEffect(() => {
    if (!uid || bodyweights.length > 0) return
    getDoc(profileRef(uid))
      .then((d) => {
        const kg = (d.data() as { bodyweightKg?: number } | undefined)?.bodyweightKg
        if (kg && kg > 0) {
          upsertBodyweight(uid, todayKey(), kg).catch(() => undefined)
        }
      })
      .catch(() => undefined)
  }, [uid, bodyweights.length])

  const saveBodyweight = (date: string, kg: number) => {
    if (!uid) return
    upsertBodyweight(uid, date, kg).catch(() => undefined)
  }

  const removeBodyweight = (date: string) => {
    if (!uid) return
    deleteBodyweight(uid, date).catch(() => undefined)
  }

  return (
    <DataContext.Provider
      value={{
        exercises,
        plans,
        sessions,
        bodyweights,
        ready,
        setExercises,
        setPlans,
        setSessions,
        saveBodyweight,
        removeBodyweight,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData outside DataProvider')
  return ctx
}