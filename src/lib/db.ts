import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFirebaseApp } from './firebase'

// Firestore dipisah dari lib/firebase.ts (yang auth-only) supaya firestore
// SDK hanya diunduh setelah login — halaman Login tidak perlu firestore.
let dbInstance: Firestore | null = null

export function getDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(getFirebaseApp())
  return dbInstance
}
