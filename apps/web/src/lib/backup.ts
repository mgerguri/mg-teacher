// Whole-database backup/restore. Everything for this app lives in one
// IndexedDB database on one device (see local-db.ts) with no server copy on
// the desktop build, so a lost/corrupted browser profile means every
// student/grade/attendance record is gone with nothing to recover from.
// This dumps every Dexie table to a single JSON file and reloads it verbatim.

import Dexie from 'dexie'
import { localDb, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } from './local-db'
import { hashPassword } from './password-hash'
import { saveFile } from './save-file'

const BACKUP_FORMAT_VERSION = 1

interface BackupFile {
  format: number
  schemaVersion: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

export async function exportBackup(): Promise<void> {
  const tables: Record<string, unknown[]> = {}
  for (const table of localDb.tables) {
    tables[table.name] = await table.toArray()
  }

  const backup: BackupFile = {
    format: BACKUP_FORMAT_VERSION,
    schemaVersion: localDb.verno,
    exportedAt: new Date().toISOString(),
    tables,
  }

  const bytes = new TextEncoder().encode(JSON.stringify(backup))
  const date  = new Date().toISOString().slice(0, 10)
  await saveFile(`mg-teacher-backup-${date}.json`, bytes)
}

export type RestoreErrorReason = 'parse' | 'format' | 'version'

export class BackupRestoreError extends Error {
  constructor(public reason: RestoreErrorReason) {
    super(`Backup restore failed: ${reason}`)
  }
}

function isBackupFile(value: unknown): value is BackupFile {
  return (
    typeof value === 'object' && value !== null &&
    typeof (value as BackupFile).format === 'number' &&
    typeof (value as BackupFile).schemaVersion === 'number' &&
    typeof (value as BackupFile).tables === 'object' && (value as BackupFile).tables !== null
  )
}

// Restoring wipes and replaces every table in one transaction — if any table
// fails to load, the whole restore rolls back rather than leaving the
// database half-old/half-new.
export async function restoreBackup(file: File): Promise<void> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new BackupRestoreError('parse')
  }

  if (!isBackupFile(parsed) || parsed.format !== BACKUP_FORMAT_VERSION) {
    throw new BackupRestoreError('format')
  }
  // Only refuse backups from a *newer* schema than this build understands.
  // Requiring an exact match meant every schema bump silently invalidated
  // every backup the user had already taken — the opposite of what a backup
  // is for, given this is the only copy of their data. Older backups are
  // fine: Dexie has already migrated the live database, and restored rows go
  // through the same tables as any other write.
  if (parsed.schemaVersion > localDb.verno) {
    throw new BackupRestoreError('version')
  }

  const backup = parsed
  const now = new Date().toISOString()

  await localDb.transaction('rw', localDb.tables, async () => {
    for (const table of localDb.tables) {
      const records = backup.tables[table.name]
      await table.clear()
      if (!Array.isArray(records) || records.length === 0) continue

      // Every restored record is marked pending so a future sync-capable
      // build re-pushes it rather than trusting a stale synced flag from
      // whenever the backup was taken. Teachers have no syncStatus field.
      const restored = table.name === 'teachers'
        ? records
        : records.map(rec => ({
            ...(rec as Record<string, unknown>),
            syncStatus: 'pending',
            updatedAt: (rec as Record<string, unknown>).updatedAt ?? now,
          }))
      await table.bulkAdd(restored)
    }

    // Restore wipes `teachers`, and on this branch that table holds the only
    // sign-in credentials there are. A backup taken before local accounts
    // existed — or one whose accounts were all removed — therefore leaves a
    // database nobody can sign into, and the populate hook in local-db.ts
    // won't help: it only fires for a database being created, never for one
    // being refilled. Put the default admin back so the restore can't lock
    // the user out of their own data.
    const teachers = await localDb.teachers.toArray()
    if (!teachers.some(t => t.passwordHash)) {
      const passwordHash = await Dexie.waitFor(hashPassword(DEFAULT_ADMIN_PASSWORD))
      const existingAdmin = teachers.find(t => t.email === DEFAULT_ADMIN_EMAIL)
      if (existingAdmin) {
        await localDb.teachers.update(existingAdmin.id, { passwordHash })
      } else {
        await localDb.teachers.add({
          id: crypto.randomUUID(),
          email: DEFAULT_ADMIN_EMAIL,
          role: 'admin',
          firstName: 'Admin',
          lastName: 'Account',
          updatedAt: new Date().toISOString(),
          passwordHash,
        })
      }
    }
  })
}
