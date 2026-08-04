import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
    try {
      localStorage.setItem('gt:lastError', String(error?.message ?? error))
    } catch {
      /* ignore */
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="auth-screen center" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>😵</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Terjadi kesalahan</div>
          <div className="muted" style={{ fontSize: 14, marginBottom: 16, wordBreak: 'break-word' }}>
            {this.state.error.message || 'Kesalahan tidak diketahui'}
          </div>
          <div className="small muted" style={{ marginBottom: 16 }}>
            Coba muat ulang, atau bersihkan cache situs (Pengaturan → Privasi → Bersihkan data situs).
          </div>
          <button
            className="btn primary"
            onClick={() => {
              try {
                localStorage.removeItem('gt:lastError')
              } catch {
                /* ignore */
              }
              window.location.hash = '#/'
              window.location.reload()
            }}
          >
            Muat ulang
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Tangkap error global (mis. gagal module load) — tampilkan fallback alih-alih layar hitam
export function installGlobalErrorFallback() {
  const el = document.createElement('div')
  el.style.cssText =
    'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'background:#0f0f14;color:#f2f2f7;font-family:sans-serif;padding:24px;text-align:center;z-index:9999'
  el.innerHTML =
    '<div style="font-size:40px;margin-bottom:8px">😵</div>' +
    '<div style="font-size:20px;font-weight:800;margin-bottom:8px">Terjadi kesalahan saat memuat aplikasi</div>' +
    '<div style="font-size:14px;color:#9a9ab0;margin-bottom:16px">Coba muat ulang, atau bersihkan cache situs.</div>' +
    '<button id="gt-reload" style="background:linear-gradient(135deg,#6366f1,#a78bfa);border:none;color:#fff;' +
    'padding:12px 24px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer">Muat ulang</button>'
  el.querySelector('#gt-reload')?.addEventListener('click', () => window.location.reload())
  const show = () => {
    if (!document.getElementById('gt-error-fallback')) {
      el.id = 'gt-error-fallback'
      document.body?.appendChild(el)
    }
  }
  window.addEventListener('error', (e) => {
    if (e.target && (e.target as HTMLElement).tagName === 'SCRIPT') {
      show()
    }
  })
}