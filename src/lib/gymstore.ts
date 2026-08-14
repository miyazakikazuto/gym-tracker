import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  setDoc,
} from 'firebase/firestore'
import { getDb } from './firebase'
import { parseKey } from './date'
import type {
  Exercise,
  WorkoutPlan,
  Session,
  SessionSet,
  Bodyweight,
} from '../types'

export function userGymRef(uid: string, sub: string) {
  return collection(getDb(), 'users', uid, sub)
}

// ===== BODYWEIGHT =====
export function bodyweightRef(uid: string) {
  return collection(getDb(), 'users', uid, 'bodyweight')
}

export function subscribeBodyweights(uid: string, cb: (list: Bodyweight[]) => void) {
  return onSnapshot(bodyweightRef(uid), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bodyweight, 'id'>) })))
  })
}

// 1 doc per tanggal (id = YYYY-MM-DD) — upsert otomatis saat tanggal sama
export function upsertBodyweight(uid: string, date: string, kg: number) {
  return setDoc(doc(getDb(), 'users', uid, 'bodyweight', date), { date, kg })
}

export function deleteBodyweight(uid: string, date: string) {
  return deleteDoc(doc(getDb(), 'users', uid, 'bodyweight', date))
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
  return updateDoc(doc(getDb(), 'users', uid, 'exercises', id), data as object)
}

export async function deleteExercise(uid: string, id: string) {
  return deleteDoc(doc(getDb(), 'users', uid, 'exercises', id))
}

export function patchExerciseCategory(uid: string, id: string, category: string) {
  return updateDoc(doc(getDb(), 'users', uid, 'exercises', id), { category })
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
  return updateDoc(doc(getDb(), 'users', uid, 'plans', id), data as object)
}

export async function deletePlan(uid: string, id: string) {
  return deleteDoc(doc(getDb(), 'users', uid, 'plans', id))
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
  return updateDoc(doc(getDb(), 'users', uid, 'sessions', id), fields as object)
}

export async function deleteSession(uid: string, id: string) {
  return deleteDoc(doc(getDb(), 'users', uid, 'sessions', id))
}

// Build a new session payload for a given date (default start 12:00 WIB)
export function buildSession(
  plan: WorkoutPlan | null | undefined,
  dateKey: string,
  typeOf?: (exerciseId: string) => 'reps' | 'duration',
  startAt?: number,
): Omit<Session, 'id'> {
  const start = startAt ?? parseKey(dateKey).getTime() + 12 * 60 * 60 * 1000
  return {
    date: dateKey,
    planId: plan?.id ?? null,
    planName: plan?.name ?? 'Sesi bebas',
    note: '',
    startedAt: start,
    endedAt: null,
    sets: (plan?.items ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((it, i) => ({
        id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        exerciseId: it.exerciseId,
        setNumber: i + 1,
        weightKg: 0,
        reps: typeOf?.(it.exerciseId) === 'duration' ? 0 : it.reps,
        ...(typeOf?.(it.exerciseId) === 'duration' ? { durationSec: it.reps } : {}),
      })),
  }
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

