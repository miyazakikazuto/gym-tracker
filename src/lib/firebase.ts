import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAQk8zcp5pZFGwRXJO7ysjGu1hQL0CziRw',
  authDomain: 'xauusd-jurnal.firebaseapp.com',
  projectId: 'xauusd-jurnal',
  storageBucket: 'xauusd-jurnal.firebasestorage.app',
  messagingSenderId: '977650715760',
  appId: '1:977650715760:web:c0c9ecad03409cd3a3b8b5',
}

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const existing = getApps()
    app = existing.length > 0 ? existing[0] : initializeApp(FIREBASE_CONFIG)
  }
  return app
}

export function getAuthInstance(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp())
    // localStorage (bukan IndexedDB): di iOS PWA standalone, localStorage
    // berbagi storage dengan Safari sehingga login dari Safari ikut terbaca app.
    setPersistence(authInstance, browserLocalPersistence).catch(() => undefined)
  }
  return authInstance
}

export function getDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(getFirebaseApp())
  return dbInstance
}