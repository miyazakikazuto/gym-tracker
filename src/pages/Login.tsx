import { useEffect, useState } from 'react'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth'
import { getAuthInstance } from '../lib/firebase'

const REDIRECT_FLAG = 'gt_redirecting'

export default function Login() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [usingRedirect, setUsingRedirect] = useState(false)
  const [showSafariGuide, setShowSafariGuide] = useState(false)

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  // Jika sebelumnya redirect sign-in dilakukan, proses hasilnya saat halaman dimuat ulang
  useEffect(() => {
    getRedirectResult(getAuthInstance())
      .then((res) => {
        if (res) {
          sessionStorage.removeItem(REDIRECT_FLAG)
          // sukses → onAuthStateChanged akan memuat app
        }
      })
      .catch(() => {
        // hasil redirect gagal / dibatalkan
      })
  }, [])

  // Setelah OAuth kembali tapi masih belum login (redirect putus di webview standalone):
  // arahkan ke Safari agar login selesai, bukan menampilkan loop tombol login.
  useEffect(() => {
    if (sessionStorage.getItem(REDIRECT_FLAG)) {
      const t = setTimeout(() => {
        sessionStorage.removeItem(REDIRECT_FLAG)
        setShowSafariGuide(true)
        setBusy(false)
      }, 2500)
      return () => clearTimeout(t)
    }
  }, [])

  async function startRedirect(auth: ReturnType<typeof getAuthInstance>, provider: GoogleAuthProvider) {
    sessionStorage.setItem(REDIRECT_FLAG, '1')
    setUsingRedirect(true)
    setError('')
    try {
      await signInWithRedirect(auth, provider)
    } catch (e2) {
      sessionStorage.removeItem(REDIRECT_FLAG)
      setUsingRedirect(false)
      setError(msgOf(e2))
    }
  }

  async function signInGoogle() {
    setError('')
    setBusy(true)
    const auth = getAuthInstance()
    const provider = new GoogleAuthProvider()

    // iOS standalone: popup selalu diblokir — langsung redirect
    if (isIos && isStandalone) {
      await startRedirect(auth, provider)
      setBusy(false)
      return
    }

    try {
      await signInWithPopup(auth, provider)
      sessionStorage.removeItem(REDIRECT_FLAG)
      // sukses → onAuthStateChanged akan memuat app
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await startRedirect(auth, provider)
      } else if (code === 'auth/popup-closed-by-user') {
        // user batal — diam saja
      } else if (code === 'auth/unauthorized-domain') {
        setError(
          'Domain situs ini belum diizinkan di Firebase. ' +
          'Buka Firebase Console → project xauusd-jurnal → Authentication → Settings → ' +
          'Authorized domains → tambahkan: miyazakikazuto.github.io',
        )
      } else if (code === 'auth/account-exists-with-different-credential') {
        setError('Akun email ini sudah terdaftar dengan cara login lain. Hubungi admin untuk digabungkan.')
      } else if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid') {
        setError('Konfigurasi Firebase tidak valid (API key). Periksa src/lib/firebase.ts.')
      } else {
        setError(msgOf(err))
      }
    } finally {
      setBusy(false)
    }
  }

  function openInSafari() {
    const url = window.location.origin + window.location.pathname
    window.open(url, '_blank')
  }

  if (showSafariGuide) {
    return (
      <div className="auth-screen">
        <div className="auth-logo">
          <img src="/gym-tracker/dumbell.svg" alt="" onError={(el) => ((el.currentTarget as HTMLImageElement).style.display = 'none')} />
        </div>
        <div className="auth-brand">Gym Tracker</div>
        <div className="auth-tag">Login belum selesai</div>

        <div className="card" style={{ width: '100%' }}>
          <div className="small muted" style={{ marginBottom: 8 }}>
            Login Google terputus di dalam app terpasang. Selesaikan di Safari — setelah masuk, buka lagi aplikasi ini dan kamu sudah login otomatis.
          </div>
          {[
            ['Ketuk "Lanjutkan di Safari"', 'Safari terbuka membawa halaman login aplikasi ini.'],
            ['Ketuk "Masuk dengan Google" di Safari', 'Halaman itu perlu ditekan tombol logannya — selesaikan sampai muncul dashboard.'],
            ['Buka lagi aplikasi di layar utama', 'Ikon Gym — kamu sudah login otomatis.'],
          ].map(([title, desc], i) => (
            <div className="row" key={i} style={{ padding: '6px 0', gap: 10 }}>
              <span className="badge accent" style={{ flex: 'none', minWidth: 26, textAlign: 'center' }}>{i + 1}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
                <div className="small muted">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions" style={{ width: '100%' }}>
          <button className="btn primary" onClick={openInSafari}>Lanjutkan di Safari</button>
          <button className="btn ghost" onClick={() => void signInGoogle()}>Coba lagi</button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">
        <img src="/gym-tracker/dumbell.svg" alt="" onError={(el) => ((el.currentTarget as HTMLImageElement).style.display = 'none')} />
      </div>
      <div className="auth-brand">Gym Tracker</div>
      <div className="auth-tag">Jadwal & log latihan kamu</div>

      {error && <div className="auth-error">{error}</div>}
      {usingRedirect && !error && (
        <div className="card" style={{ background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)' }}>
          <div className="small">Mengalihkan ke halaman Google… Setelah memilih akun kamu akan kembali otomatis.</div>
        </div>
      )}

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
