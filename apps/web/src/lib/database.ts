import { PowerSyncDatabase } from '@powersync/web'
import { AppSchema } from '@mg-teacher/db'
import { AppConnector } from './powersync-connector'

// Singleton — one PowerSync database per app session
let _db: PowerSyncDatabase | null = null
let _connector: AppConnector | null = null

export function getDatabase(): PowerSyncDatabase {
  if (!_db) {
    _db = new PowerSyncDatabase({
      schema: AppSchema,
      database: { dbFilename: 'mg-teacher.db' },
    })
  }
  return _db
}

export function getConnector(): AppConnector {
  if (!_connector) {
    _connector = new AppConnector()
  }
  return _connector
}
