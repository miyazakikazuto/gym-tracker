import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { getFirebaseApp } from './firebase'

// Firestore dipisah dari lib/firebase.ts (yang auth-only) supaya firestore
// SDK hanya diunduh setelah login — halaman Login tidak perlu firestore.
let dbInstance: Firestore | null = null

// Cache persisten (IndexedDB): tulisan saat offline masuk antrean & auto-sync
// begitu online; snapshot berikutnya dilayani instan dari cache. Multi-tab
// manager supaya beberapa tab perangkat yang sama tidak saling mengunci cache.
export function getDb(): Firestore {
  if (!dbInstance) {
    try {
      dbInstance = initializeFirestore(getFirebaseApp(), {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    } catch {
      // Firestore sudah terinisialisasi untuk app ini (mis. HMR dev) → pakai instance yang ada.
      dbInstance = getFirestore(getFirebaseApp())
    }
  }
  return dbInstance
}
