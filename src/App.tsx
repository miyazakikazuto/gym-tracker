import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
// Halaman pertama (Login & Today) dimuat statis supaya app langsung muncul.
// Halaman sekunder di-lazy: chunk-nya diunduh hanya saat dibuka (code-splitting),
// lalu di-cache service worker — initial load lebih ringan.
import Login from './pages/Login'
import Today from './pages/Today'
import Layout from './components/Layout'

const Session = lazy(() => import('./pages/Session'))
const History = lazy(() => import('./pages/History'))
const Progress = lazy(() => import('./pages/Progress'))
const Weight = lazy(() => import('./pages/Weight'))
const Library = lazy(() => import('./pages/Library'))
const Settings = lazy(() => import('./pages/Settings'))

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="auth-screen center">
        <div className="auth-tag">Memuat…</div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <DataProvider>
      <Suspense fallback={<div className="empty">Memuat…</div>}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Today />} />
            <Route path="/today" element={<Today />} />
            <Route path="/session/:id" element={<Session />} />
            <Route path="/history" element={<History />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/weight" element={<Weight />} />
            <Route path="/library" element={<Library />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Today />} />
          </Route>
        </Routes>
      </Suspense>
    </DataProvider>
  )
}

export default App