import { useEffect, useRef } from 'react'
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
    case 'berat':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3v5" />
          <circle cx="12" cy="11" r="3" />
          <path d="M6.5 21L5 12.5a8.4 8.4 0 0 1 14 0L17.5 21" />
          <path d="M4 21h16" />
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
  { path: '/weight', label: 'Berat', key: 'berat' },
  { path: '/library', label: 'Gerakan', key: 'library' },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const appRef = useRef<HTMLElement>(null)

  // Reset scroll saat pindah tab
  useEffect(() => {
    appRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  const isActive = (t: (typeof TABS)[number]) =>
    location.pathname === t.path ||
    (t.key === 'today' && (location.pathname === '/' || location.pathname.startsWith('/session'))) ||
    (!('/' === t.path) && location.pathname.startsWith(t.path) && t.path !== '/today')

  return (
    <>
      <main className="app" ref={appRef}>
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