import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Role = 'admin' | 'teacher'

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: Role
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// The signed-in user is cached alongside the token so the app can start
// without the network. This is display/routing state only — every request is
// still authorised by the token, server-side.
const USER_KEY = 'mg_teacher_user'

function readCachedUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readCachedUser())
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  // On mount, revalidate the stored token — but only treat an actual rejection
  // from the server as "signed out". This used to sign the user out on *any*
  // failure, so launching the app offline (the normal case for an
  // offline-first app, and the only case for the desktop build with no
  // reachable API) dropped the token and stranded the user on the login
  // screen with their data inaccessible behind it.
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        if (cancelled) return

        if (res.status === 401 || res.status === 403) {
          // The token really is invalid or expired — this is the one case
          // that should end the session.
          localStorage.removeItem('token')
          localStorage.removeItem(USER_KEY)
          setToken(null)
          setUser(null)
        } else if (res.ok) {
          const fresh: AuthUser = await res.json()
          if (cancelled) return
          const serialised = JSON.stringify(fresh)
          localStorage.setItem(USER_KEY, serialised)
          // Only swap the object in when something actually changed. Several
          // effects around the app key off `user`, and handing them a new
          // identity holding identical data re-runs them for nothing.
          setUser(prev => (prev && JSON.stringify(prev) === serialised ? prev : fresh))
        }
        // Any other status (5xx, proxy error…) means the server could not
        // answer, not that the session is bad. Keep the cached user.
      } catch {
        // Network unreachable — offline. Keep the cached user.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? 'Login failed')
    }

    const data = await res.json()
    localStorage.setItem('token', data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
