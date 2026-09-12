import { createContext, useContext, ReactNode } from 'react'

// Desktop build: all data lives on-device (see local-db.ts), there is no
// cloud backend to sync with. This stub keeps the same hook shape as the
// cloud build's SyncContext so shared UI (e.g. the sync indicator in
// App.tsx) doesn't need to branch on which build it's in.

// Kept as a union (not narrowed to 'idle') so it matches the cloud build's
// SyncContext shape and call sites don't need to branch per build.
type SyncState = 'idle' | 'syncing' | 'error'

interface SyncContextValue {
  state: SyncState
  lastSyncedAt: string | null
  sync: () => Promise<void>
}

const value: SyncContextValue = {
  state: 'idle',
  lastSyncedAt: null,
  sync: async () => {},
}

const SyncContext = createContext<SyncContextValue>(value)

export function SyncProvider({ children }: { children: ReactNode }) {
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync() {
  return useContext(SyncContext)
}
