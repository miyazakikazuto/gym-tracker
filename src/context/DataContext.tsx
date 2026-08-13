import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeExercises,
  subscribePlans,
  subscribeSessions,
  patchExerciseCategory,
} from '../lib/gymstore'
import { categoryOfExercise } from '../lib/helpers'
import type { Exercise, WorkoutPlan, Session } from '../types'

interface DataState {
  exercises: Exercise[]
  plans: WorkoutPlan[]
  sessions: Session[]
  ready: boolean
  setExercises: React.Dispatch<React.SetStateAction<Exercise[]>>
  setPlans: React.Dispatch<React.SetStateAction<WorkoutPlan[]>>
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>
}

const DataContext = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!uid) return
    setReady(false)
    const unsubs = [
      subscribeExercises(uid, setExercises),
      subscribePlans(uid, setPlans),
      subscribeSessions(uid, setSessions),
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

  return (
    <DataContext.Provider
      value={{
        exercises,
        plans,
        sessions,
        ready,
        setExercises,
        setPlans,
        setSessions,
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