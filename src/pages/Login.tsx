import { useState } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getAuthInstance } from '../lib/firebase'
import { signInWithGsi } from '../lib/gsi'

export default function Login() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'google' | 'email'>('google')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function signInGoogle() {
    setError('')
    setBusy(true)
    try {
      await signInWithGsi()
      // sukses → onAuthStateChanged akan memuat app
    } catch (err) {
      setError(msgOf(err))
    } finally {
      setBusy(false)
    }
  }

  async function signInEmail() {
    setError('')
    const em = email.trim().toLowerCase()
    if (!em || !password) {
      setError('Isi email dan kata sandi dulu.')
      return
    }
    setBusy(true)
    const auth = getAuthInstance()
    try {
      await signInWithEmailAndPassword(auth, em, password)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
        try {
          await createUserWithEmailAndPassword(auth, em, password)
        } catch (e2) {
          const code2 = (e2 as { code?: string }).code
          if (code2 === 'auth/email-already-in-use') {
            setError(
              'Email ini sudah terdaftar sebagai akun Google. Buka aplikasi di perangkat yang masih masuk Google ' +
              '(tombol gembok di halaman Hari Ini → Atur kata sandi), lalu setelah itu login di sini.',
            )
          } else {
            setError(msgOf(e2))
          }
        }
      } else {
        setError(msgOf(err))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">
        <img src="/gym-tracker/dumbell.svg" alt="" onError={(el) => ((el.currentTarget as HTMLImageElement).style.display = 'none')} />
      </div>
      <div className="auth-brand">Gym Tracker</div>
      <div className="auth-tag">Jadwal & log latihan kamu</div>

      {error && <div className="auth-error">{error}</div>}

      {mode === 'google' ? (
        <>
          <button className="btn wide" onClick={() => void signInGoogle()} disabled={busy}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              padding: '13px 16px',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.4 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.4 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
            </svg>
            <span>{busy ? 'Menghubungkan…' : 'Masuk dengan Google'}</span>
          </button>
          <button className="btn ghost" style={{ width: '100%', marginTop: 10 }}
            onClick={() => { setError(''); setMode('email') }}>
            Masuk dengan email
          </button>
        </>
      ) : (
        <form className="card" style={{ width: '100%', display: 'grid', gap: 10 }}
          onSubmit={(e) => { e.preventDefault(); void signInEmail() }}>
          <input className="input" type="email" inputMode="email" autoComplete="email"
            placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={busy} />
          <input className="input" type="password" autoComplete="current-password"
            placeholder="Kata sandi" value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          <button className="btn primary" disabled={busy}>
            {busy ? 'Menghubungkan…' : 'Masuk'}
          </button>
          <div className="small muted" style={{ textAlign: 'center' }}>
            Akun baru dibuat otomatis saat pertama masuk.
          </div>
          <button type="button" className="btn ghost" disabled={busy}
            onClick={() => { setError(''); setMode('google') }}>
            Kembali ke masuk Google
          </button>
        </form>
      )}

      <div className="small muted center" style={{ marginTop: 16 }}>
        Data kamu tersimpan di cloud — bisa diakses dari HP & PC.
      </div>
    </div>
  )
}

function msgOf(err: unknown): string {
  const m = (err as { message?: string }).message
  if (!m) return 'Terjadi kesalahan. Coba lagi.'
  const cleaned = m
    .replace(/^Firebase: /, '')
    .replace(/ \(.*\)\.$/, '')
  return cleaned
}