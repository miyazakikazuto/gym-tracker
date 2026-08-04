import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

function navIcons(name: string) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'today':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3l8 4v5l-8 4-8-4V7l8-4z" />
          <path d="M12 15v6M4 7v5" />
        </svg>
      )
    case 'history':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M8 2v4M16 2v4M3 9h18" />
        </svg>
      )
    case 'progress':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M3 3v18h18" />
          <path d="M7 13l4-4 3 3 5-6" />
        </svg>
      )
    case 'library':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      )
    default:
      return <span />
  }
}

const TABS = [
  { path: '/today', label: 'Hari Ini', key: 'today' },
  { path: '/history', label: 'Riwayat', key: 'history' },
  { path: '/progress', label: 'Progress', key: 'progress' },
  { path: '/library', label: 'Gerakan', key: 'library' },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  // Reset scroll saat pindah tab
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Pin bottom-nav ke dasar area yang terlihat (visual viewport),
  // agar tidak tersembunyi di balik URL bar Android Chrome
  useEffect(() => {
    const nav = document.querySelector('.bottom-nav') as HTMLElement | null
    if (!nav || typeof window.visualViewport === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const pin = () => {
      nav.style.bottom = `${Math.max(0, window.innerHeight - (vv.offsetTop + vv.height))}px`
    }
    vv.addEventListener('resize', pin)
    vv.addEventListener('scroll', pin)
    pin()
    return () => {
      vv.removeEventListener('resize', pin)
      vv.removeEventListener('scroll', pin)
    }
  }, [])

  const isActive = (t: (typeof TABS)[number]) =>
    location.pathname === t.path ||
    (t.key === 'today' && (location.pathname === '/' || location.pathname.startsWith('/session'))) ||
    (!('/' === t.path) && location.pathname.startsWith(t.path) && t.path !== '/today')

  return (
    <>
      <main className="app">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'nav-item' + (isActive(t) ? ' active' : '')}
            onClick={() => navigate(t.path)}
          >
            {navIcons(t.key)}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}