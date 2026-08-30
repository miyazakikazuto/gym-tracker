import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { getDb } from './db'
import { parseKey } from './date'
import type {
  Exercise,
  WorkoutPlan,
  Session,
  SessionSet,
  Bodyweight,
  UserSettings,
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

// meta.fromServer = true saat data datang dari server Firestore (bukan cache
// lokal). Dipakai DataContext untuk memastikan seed default hanya jalan SETELAH
// kita yakin akun benar-benar kosong — bukan sekadar cache yang belum terisi.
export function subscribeExercises(
  uid: string,
  cb: (list: Exercise[], meta?: { fromServer: boolean }) => void,
) {
  return onSnapshot(userGymRef(uid, 'exercises'), (snap) => {
    cb(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Exercise, 'id'>) })),
      { fromServer: !snap.metadata.fromCache },
    )
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

// Batch: satu round-trip untuk banyak update kategori (migrasi akun lama).
export async function patchExerciseCategories(
  uid: string,
  entries: Array<{ id: string; category: string }>,
) {
  if (entries.length === 0) return
  const db = getDb()
  const CHUNK = 400
  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const { id, category } of entries.slice(i, i + CHUNK)) {
      batch.update(doc(db, 'users', uid, 'exercises', id), { category })
    }
    await batch.commit()
  }
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
  cycleSnapshot?: { cycle: number; sessionIndex: number; cycleLabel: string; scheme?: string },
  isExtra?: boolean,
): Omit<Session, 'id'> {
  const start = startAt ?? parseKey(dateKey).getTime() + 12 * 60 * 60 * 1000
  return {
    date: dateKey,
    planId: plan?.id ?? null,
    planName: plan?.name ?? 'Sesi bebas',
    note: '',
    startedAt: start,
    endedAt: null,
    ...(cycleSnapshot
      ? {
          cycle: cycleSnapshot.cycle,
          sessionIndex: cycleSnapshot.sessionIndex,
          cycleLabel: cycleSnapshot.cycleLabel,
          ...(cycleSnapshot.scheme ? { scheme: cycleSnapshot.scheme } : {}),
        }
      : {}),
    ...(isExtra ? { isExtra: true as const } : {}),
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

// ===== USER SETTINGS =====
export function settingsRef(uid: string) {
  return doc(getDb(), 'users', uid, 'settings', 'prefs')
}

export function subscribeSettings(uid: string, cb: (s: Partial<UserSettings>) => void) {
  return onSnapshot(settingsRef(uid), (snap) => {
    cb((snap.data() ?? {}) as Partial<UserSettings>)
  })
}

export function updateSettings(uid: string, patch: Partial<UserSettings>) {
  return setDoc(settingsRef(uid), patch, { merge: true })
}

// ===== IMPORT BACKUP (restore) =====
// Tulis ulang data backup dengan ID asli (setDoc, bukan addDoc) supaya referensi
// antar dokumen (session.planId, set.exerciseId, planItem.exerciseId) tetap utuh.
// ID yang sudah ada akan ditimpa — perilaku restore. Bodyweight: id = tanggal.
// Peringatan: chunk 400 commit sequential — tidak atomik lintas-chunk. Jika chunk
// tengah gagal, data menjadi parsial; user harus retry restore penuh.
export async function importBackup(
  uid: string,
  data: {
    exercises: Exercise[]
    plans: WorkoutPlan[]
    sessions: Session[]
    bodyweights: Bodyweight[]
    settings?: Partial<UserSettings>
  },
): Promise<number> {
  const db = getDb()
  const writes: Array<{ ref: DocumentReference; value: object }> = []

  if (data.settings && Object.keys(data.settings).length > 0) {
    writes.push({ ref: doc(db, 'users', uid, 'settings', 'prefs'), value: data.settings })
  }

  for (const e of data.exercises) {
    const { id, ...rest } = e
    if (!id || id.includes('/')) continue
    writes.push({ ref: doc(db, 'users', uid, 'exercises', id), value: rest })
  }
  for (const p of data.plans) {
    const { id, ...rest } = p
    if (!id || id.includes('/')) continue
    writes.push({ ref: doc(db, 'users', uid, 'plans', id), value: rest })
  }
  for (const s of data.sessions) {
    const { id, ...rest } = s
    if (!id || id.includes('/')) continue
    writes.push({ ref: doc(db, 'users', uid, 'sessions', id), value: rest })
  }
  for (const w of data.bodyweights) {
    if (!w.date || typeof w.kg !== 'number') continue
    writes.push({
      ref: doc(db, 'users', uid, 'bodyweight', w.date),
      value: { date: w.date, kg: w.kg },
    })
  }

  const CHUNK = 400 // batas maksimal 500 tulis per batch Firestore
  for (let i = 0; i < writes.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const { ref, value } of writes.slice(i, i + CHUNK)) {
      batch.set(ref, value)
    }
    await batch.commit()
  }
  return writes.length
}

