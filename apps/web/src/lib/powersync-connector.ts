import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/web'

const POWERSYNC_URL = import.meta.env.VITE_POWERSYNC_URL as string

// Maps PowerSync table names to API resource paths
const TABLE_TO_PATH: Record<string, string> = {
  students: '/api/students',
  subjects: '/api/subjects',
  classes:  '/api/classes',
  schedules: '/api/schedules',
}

export class AppConnector implements PowerSyncBackendConnector {
  private getToken(): string | null {
    return localStorage.getItem('token')
  }

  // Called by PowerSync to get sync credentials.
  // We exchange our auth token for a short-lived PowerSync token.
  async fetchCredentials() {
    const token = this.getToken()
    if (!token) throw new Error('Not authenticated')

    const res = await fetch('/api/auth/powersync-token', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error('Failed to fetch PowerSync token')

    const { token: psToken } = await res.json()
    return { endpoint: POWERSYNC_URL, token: psToken }
  }

  // Called by PowerSync when there are local writes to upload.
  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) return

    const token = this.getToken()
    if (!token) throw new Error('Not authenticated')

    try {
      for (const op of transaction.crud) {
        await this.uploadOperation(op, token)
      }
      await transaction.complete()
    } catch (err) {
      // PowerSync will retry on next opportunity
      console.error('[sync] upload failed', err)
      throw err
    }
  }

  private async uploadOperation(op: CrudEntry, token: string) {
    const path = TABLE_TO_PATH[op.table]
    if (!path) {
      console.warn(`[sync] no API path for table "${op.table}" — skipping`)
      return
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }

    if (op.op === UpdateType.PUT) {
      await fetch(`${path}/${op.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ id: op.id, ...op.opData }),
      })
    } else if (op.op === UpdateType.PATCH) {
      await fetch(`${path}/${op.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(op.opData),
      })
    } else if (op.op === UpdateType.DELETE) {
      await fetch(`${path}/${op.id}`, { method: 'DELETE', headers })
    }
  }
}
