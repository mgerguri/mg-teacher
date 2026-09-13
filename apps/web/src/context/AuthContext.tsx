import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { localDb } from '../lib/local-db'
import { hasAnyAccount, createLocalAccount, verifyLocalLogin, CreateAccountInput } from '../lib/local-auth'

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
  isLoading: boolean
  // True until the first local account has been created on this device.
  needsSetup: boolean
  login: (email: string, password: string) => Promise<void>
  createAccount: (input: Omit<CreateAccountInput, 'role'>) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Remembers which local teacher is signed in on this device — no server session involved.
const SESSION_KEY = 'mg_teacher_session_user_id'

function toAuthUser(teacher: { id: string; email: string; firstName: string; lastName: string; role: Role }): AuthUser {
  return { id: teacher.id, email: teacher.email, firstName: teacher.firstName, lastName: teacher.lastName, role: teacher.role }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function restore() {
      const anyAccount = await hasAnyAccount()
      if (cancelled) return
      setNeedsSetup(!anyAccount)

      const savedId = localStorage.getItem(SESSION_KEY)
      if (savedId) {
        const teacher = await localDb.teachers.get(savedId)
        if (cancelled) return
        if (teacher) setUser(toAuthUser(teacher))
        else localStorage.removeItem(SESSION_KEY)
      }
      setIsLoading(false)
    }
    restore()
    return () => { cancelled = true }
  }, [])

  async function login(email: string, password: string) {
    const teacher = await verifyLocalLogin(email, password)
    localStorage.setItem(SESSION_KEY, teacher.id)
    setUser(toAuthUser(teacher))
  }

  async function createAccount(input: Omit<CreateAccountInput, 'role'>) {
    // Desktop installs are single-teacher by default — the first account is
    // a regular teacher, not an admin, so the Teachers admin page (gated to
    // role === 'admin') stays hidden for the common solo-teacher case.
    const teacher = await createLocalAccount({ ...input, role: 'teacher' })
    setNeedsSetup(false)
    localStorage.setItem(SESSION_KEY, teacher.id)
    setUser(toAuthUser(teacher))
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, needsSetup, login, createAccount, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
