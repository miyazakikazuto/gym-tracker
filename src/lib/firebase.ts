import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth'

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCWUgUIyxwEKifTGkf9gfQ78ygahP2EvZE',
  authDomain: 'gym-tracker-db-53d67.firebaseapp.com',
  projectId: 'gym-tracker-db-53d67',
  storageBucket: 'gym-tracker-db-53d67.firebasestorage.app',
  messagingSenderId: '744118317355',
  appId: '1:744118317355:web:689d852612ef0437ee556e',
}

let app: FirebaseApp | null = null
let authInstance: Auth | null = null

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

