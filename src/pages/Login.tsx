import { useState, type FormEvent } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { getAuthInstance } from '../lib/firebase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email.includes('@')) {
      setError('Email tidak valid.')
      return
    }
    if (pass.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }
    setBusy(true)
    try {
      const auth = getAuthInstance()
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, pass)
      } else {
        await createUserWithEmailAndPassword(auth, email, pass)
      }
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setError('Email sudah terdaftar. Coba login.')
        setMode('login')
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Email atau password salah.')
      } else if (code === 'auth/user-not-found') {
        setError('Email belum terdaftar. Pilih "Daftar akun baru".')
      } else {
        setError((err as { message: string }).message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function resetPass() {
    if (!email.includes('@')) {
      setError('Masukkan email dulu untuk reset password.')
      return
    }
    try {
      await sendPasswordResetEmail(getAuthInstance(), email)
      setInfo('Link reset password terkirim ke email Anda.')
      setError('')
    } catch (e) {
      setError((e as { message: string }).message)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">
        <img src="gym-tracker/dumbell.svg" alt="" onError={(el) => ((el.currentTarget as HTMLImageElement).style.display = 'none')} />
      </div>
      <div className="auth-brand">Gym Tracker</div>
      <div className="auth-tag">Jadwal & log latihan kamu</div>

      {error && <div className="auth-error">{error}</div>}
      {info && <div className="card" style={{ background: 'rgba(52,211,153,0.1)' }}>{info}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kamu@email.com"
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>
        <button className="btn primary wide" disabled={busy} type="submit">
          {busy ? 'Tunggu…' : mode === 'login' ? 'Masuk' : 'Daftar & Masuk'}
        </button>
      </form>

      <div className="form-actions" style={{ marginTop: 14 }}>
        {mode === 'login' ? (
          <>
            <button className="btn ghost" onClick={() => setMode('signup')}>Daftar akun baru</button>
            <button className="btn ghost" onClick={resetPass}>Lupa password?</button>
          </>
        ) : (
          <button className="btn ghost wide" onClick={() => setMode('login')}>Sudah punya akun — login</button>
        )}
      </div>
    </div>
  )
}