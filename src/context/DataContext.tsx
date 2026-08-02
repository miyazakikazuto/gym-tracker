import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import {
  subscribeExercises,
  subscribePlans,
  subscribeSessions,
} from '../lib/gymstore'
import type { Exercise, WorkoutPlan, Session } from '../types'

interface DataState {
  exercises: Exercise[]
  plans: WorkoutPlan[]
  sessions: Session[]
  ready: boolean
  refresh: () => Promise<void>
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

  const refresh = useCallback(async () => {
    setReady(false)
    await new Promise((r) => setTimeout(r, 300))
    setReady(true)
  }, [])

  return (
    <DataContext.Provider
      value={{
        exercises,
        plans,
        sessions,
        ready,
        refresh,
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