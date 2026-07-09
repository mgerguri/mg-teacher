import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { PowerSyncDatabase } from '@powersync/web'
import { getDatabase, getConnector } from '../lib/database'
import { useAuth } from './AuthContext'

interface DatabaseContextValue {
  db: PowerSyncDatabase
  isReady: boolean
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null)

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [isReady, setIsReady] = useState(false)
  const db = getDatabase()

  useEffect(() => {
    if (!user) {
      // Disconnect sync when logged out
      db.disconnect()
      setIsReady(false)
      return
    }

    // Connect and start syncing once the user is authenticated
    db.connect(getConnector())
      .then(() => setIsReady(true))
      .catch(err => console.error('[sync] connect failed', err))

    return () => {
      db.disconnect()
    }
  }, [user, db])

  return (
    <DatabaseContext.Provider value={{ db, isReady }}>
      {children}
    </DatabaseContext.Provider>
  )
}

export function useDatabase() {
  const ctx = useContext(DatabaseContext)
  if (!ctx) throw new Error('useDatabase must be used inside DatabaseProvider')
  return ctx
}
