import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { syncEngine } from '../lib/sync-engine'

type SyncState = 'idle' | 'syncing' | 'error'

interface SyncContextValue {
  state: SyncState
  lastSyncedAt: string | null
  sync: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

// How often to auto-sync while online (ms)
const SYNC_INTERVAL_MS = 60_000

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth()
  const [state, setState] = useState<SyncState>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => localStorage.getItem('mg_teacher_last_synced_at')
  )
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function sync() {
    if (!token || state === 'syncing') return
    setState('syncing')
    try {
      await syncEngine.sync(token)
      const now = new Date().toISOString()
      setLastSyncedAt(now)
      setState('idle')
    } catch (err) {
      console.error('[sync] failed', err)
      setState('error')
    }
  }

  useEffect(() => {
    if (!user || !token) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    // Sync immediately on login / mount
    sync()

    // Then sync on a regular interval
    intervalRef.current = setInterval(sync, SYNC_INTERVAL_MS)

    // Sync when the browser comes back online
    window.addEventListener('online', sync)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('online', sync)
    }
  }, [user, token]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SyncContext.Provider value={{ state, lastSyncedAt, sync }}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used inside SyncProvider')
  return ctx
}
