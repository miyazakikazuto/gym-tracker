import { OAuthProvider, signInWithCredential } from 'firebase/auth'
import { getAuthInstance } from './firebase'

// Google Cloud Console → project xauusd-jurnal → APIs & Services → Credentials →
// "Web client (auto created by Google Service)" → Client ID
export const GOOGLE_CLIENT_ID = '977650715760-66tcuklejebnqgff88ih12slt1a6chkh.apps.googleusercontent.com'

interface TokenClientResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

interface TokenClient {
  requestAccessToken: (override?: { prompt?: string }) => void
}

interface TokenClientConfig {
  client_id: string
  scope: string
  prompt?: string
  callback: (resp: TokenClientResponse) => void
  error_callback?: (err: { error: string; error_description?: string }) => void
}

interface GsiWindow extends Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: TokenClientConfig) => TokenClient
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadGsiScript(): Promise<void> {
  const w = window as GsiWindow
  if (w.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Gagal memuat Google Sign-In. Periksa koneksi internet.'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export function signInWithGsi(): Promise<void> {
  if (GOOGLE_CLIENT_ID.startsWith('PASTE_')) {
    return Promise.reject(new Error('Google Client ID belum diisi di src/lib/gsi.ts'))
  }
  return loadGsiScript().then(() => {
    const g = (window as GsiWindow).google
    if (!g?.accounts?.oauth2) {
      throw new Error('Google Sign-In tidak tersedia di browser ini.')
    }
    return new Promise<void>((resolve, reject) => {
      const client = g.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: async (resp) => {
          try {
            const provider = new OAuthProvider('google.com')
            const credential = provider.credential({ accessToken: resp.access_token })
            await signInWithCredential(getAuthInstance(), credential)
            resolve()
          } catch (e) {
            reject(e)
          }
        },
        error_callback: (err) => {
          reject(new Error(err.error_description || err.error || 'Google Sign-In dibatalkan.'))
        },
      })
      client.requestAccessToken()
    })
  })
}