import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
// Login & Layout statis supaya halaman login langsung muncul tanpa firestore.
// DataProvider di-lazy: firestore SDK hanya diunduh SETELAH login sukses
// (Login tidak butuh data). Halaman lain juga lazy per-halaman.
import Login from './pages/Login'
import Layout from './components/Layout'

const DataProvider = lazy(() => import('./context/DataContext').then((m) => ({ default: m.DataProvider })))
const Today = lazy(() => import('./pages/Today'))
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
    <Suspense fallback={<div className="empty">Memuat…</div>}>
      <DataProvider>
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
      </DataProvider>
    </Suspense>
  )
}

export default App