import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import Login from './pages/Login'
import Today from './pages/Today'
import Session from './pages/Session'
import History from './pages/History'
import Progress from './pages/Progress'
import Weight from './pages/Weight'
import Library from './pages/Library'
import Settings from './pages/Settings'
import Layout from './components/Layout'

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
  )
}

export default App