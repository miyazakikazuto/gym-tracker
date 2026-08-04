import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { getAuthInstance } from '../lib/firebase'

interface AuthState {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuthInstance(), (u) => {
      setUser(u)
      setLoading(false)
    })
    // Fallback: kalau auth tidak pernah memanggil balik (mis. jaringan diblokir),
    // tampilkan halaman login setelah 5 detik — jangan diam di layar loading.
    const timeout = setTimeout(() => setLoading(false), 5000)
    return () => {
      unsub()
      clearTimeout(timeout)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function useUid(): string {
  const { user } = useAuth()
  if (!user) throw new Error('not logged in')
  return user.uid
}