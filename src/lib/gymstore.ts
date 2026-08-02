import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore'
import { getDb } from './firebase'
import type {
  Exercise,
  WorkoutPlan,
  Session,
  SessionSet,
} from '../types'

export function userGymRef(uid: string, sub: string) {
  return collection(getDb(), 'users', uid, 'gym', sub)
}

// ===== EXERCISES =====
export async function fetchExercises(uid: string): Promise<Exercise[]> {
  const snap = await getDocs(userGymRef(uid, 'exercises'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exercise, 'id'>) }))
}

export function subscribeExercises(uid: string, cb: (list: Exercise[]) => void) {
  return onSnapshot(userGymRef(uid, 'exercises'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exercise, 'id'>) })))
  })
}

export async function createExercise(uid: string, data: Omit<Exercise, 'id'>) {
  return addDoc(userGymRef(uid, 'exercises'), data)
}

export async function updateExercise(uid: string, id: string, data: Omit<Exercise, 'id'>) {
  return updateDoc(doc(getDb(), 'users', uid, 'gym', 'exercises', id), data as object)
}

export async function deleteExercise(uid: string, id: string) {
  return deleteDoc(doc(getDb(), 'users', uid, 'gym', 'exercises', id))
}

// ===== PLANS =====
export async function fetchPlans(uid: string): Promise<WorkoutPlan[]> {
  const snap = await getDocs(userGymRef(uid, 'plans'))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkoutPlan, 'id'>) }))
}

export function subscribePlans(uid: string, cb: (list: WorkoutPlan[]) => void) {
  return onSnapshot(userGymRef(uid, 'plans'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkoutPlan, 'id'>) })))
  })
}

export async function createPlan(uid: string, data: Omit<WorkoutPlan, 'id'>) {
  return addDoc(userGymRef(uid, 'plans'), data)
}

export async function updatePlan(uid: string, id: string, data: Omit<WorkoutPlan, 'id'>) {
  return updateDoc(doc(getDb(), 'users', uid, 'gym', 'plans', id), data as object)
}

export async function deletePlan(uid: string, id: string) {
  return deleteDoc(doc(getDb(), 'users', uid, 'gym', 'plans', id))
}

// ===== SESSIONS =====
export async function fetchSessions(uid: string): Promise<Session[]> {
  const snap = await getDocs(userGymRef(uid, 'sessions'))
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Session, 'id'>),
  }))
}

export function subscribeSessions(uid: string, cb: (list: Session[]) => void) {
  return onSnapshot(userGymRef(uid, 'sessions'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Session, 'id'>) })))
  })
}

export async function createSession(uid: string, data: Omit<Session, 'id'>) {
  return addDoc(userGymRef(uid, 'sessions'), data)
}

export async function updateSession(uid: string, id: string, fields: Partial<Session>) {
  return updateDoc(doc(getDb(), 'users', uid, 'gym', 'sessions', id), fields as object)
}

export async function deleteSession(uid: string, id: string) {
  return deleteDoc(doc(getDb(), 'users', uid, 'gym', 'sessions', id))
}

// sets are stored inline inside session.sets
export function makeSetId() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function makeSessionSet(partial: Partial<SessionSet> & { exerciseId: string }): SessionSet {
  return {
    id: partial.id ?? makeSetId(),
    exerciseId: partial.exerciseId,
    setNumber: partial.setNumber ?? 1,
    weightKg: partial.weightKg ?? 0,
    reps: partial.reps ?? 0,
  }
}

