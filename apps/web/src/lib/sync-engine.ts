import Dexie from 'dexie'
import { localDb, SyncStatus } from './local-db'

const LAST_SYNCED_KEY = 'mg_teacher_last_synced_at'

// ── Types matching what the API returns ───────────────────────────────────────

type SyncTable =
  | 'students' | 'subjects' | 'classes' | 'schedules' | 'grades' | 'attendances'
  | 'weeklyPlans' | 'weeklyPlanEntries' | 'conductNotes' | 'contactLogs' | 'assessments'

const SYNC_TABLES: SyncTable[] = [
  'students', 'subjects', 'classes', 'schedules', 'grades', 'attendances',
  'weeklyPlans', 'weeklyPlanEntries', 'conductNotes', 'contactLogs', 'assessments',
]

interface SyncPushResponse {
  ok: boolean
  // Ids the server refused (ownership filters). Absent when talking to an
  // older API, which is treated as "nothing rejected".
  rejected?: Partial<Record<SyncTable, string[]>>
}

interface SyncPullResponse {
  // Server clock, captured before the server read anything. Stored verbatim
  // and sent back as the next ?since=.
  syncedAt?: string
  teachers:          ServerRecord[]
  students:          ServerRecord[]
  subjects:          ServerRecord[]
  classes:           ServerRecord[]
  schedules:         ServerRecord[]
  grades:            ServerRecord[]
  attendances:       ServerRecord[]
  weeklyPlans:       ServerRecord[]
  weeklyPlanEntries: ServerRecord[]
  conductNotes:      ServerRecord[]
  contactLogs:       ServerRecord[]
  assessments:       ServerRecord[]
}

interface ServerRecord {
  id: string
  updatedAt: string
  deletedAt?: string
  [key: string]: unknown
}

// The shape every synced table shares. Enough to drive push/pull generically
// without reaching for `any` at each call site.
interface SyncedRow {
  id: string
  updatedAt: string
  syncStatus: SyncStatus
}

type AnySyncTable = Dexie.Table<SyncedRow, string>

// Returns true if incoming record is newer than what we have locally.
function isNewer(incoming: string, existing: string | undefined): boolean {
  if (!existing) return true
  return new Date(incoming) >= new Date(existing)
}

// ── Sync engine ───────────────────────────────────────────────────────────────

export class SyncEngine {
  // ── Push ────────────────────────────────────────────────────────────────────

  async push(token: string): Promise<void> {
    const pending = {} as Record<SyncTable, SyncedRow[]>
    await Promise.all(
      SYNC_TABLES.map(async name => {
        pending[name] = await (localDb[name] as AnySyncTable).where('syncStatus').equals('pending').toArray()
      })
    )

    const hasPending = SYNC_TABLES.some(name => pending[name].length > 0)
    if (!hasPending) return

    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(pending),
    })

    if (!res.ok) throw new Error(`Push failed: ${res.status}`)

    const body: SyncPushResponse = await res.json().catch(() => ({ ok: true }))

    await localDb.transaction('rw', SYNC_TABLES.map(name => localDb[name]), async () => {
      for (const name of SYNC_TABLES) {
        const table = localDb[name] as AnySyncTable
        const rejected = new Set(body.rejected?.[name] ?? [])

        for (const sent of pending[name]) {
          // The server told us it discarded this one (it belongs to another
          // teacher's class, or to no class at all). Leaving it pending keeps
          // it on the retry queue instead of pretending it was saved.
          if (rejected.has(sent.id)) continue

          // The record may have been edited again between reading it above and
          // the push completing — that edit set syncStatus back to 'pending'
          // and was never sent, so marking it 'synced' here would strand it
          // locally forever. updatedAt is bumped on every write, so a changed
          // value means exactly that.
          const current = await table.get(sent.id)
          if (!current || current.updatedAt !== sent.updatedAt) continue

          await table.update(sent.id, { syncStatus: 'synced' })
        }
      }
    })

    const rejectedCount = SYNC_TABLES.reduce((n, name) => n + (body.rejected?.[name]?.length ?? 0), 0)
    if (rejectedCount > 0) {
      console.warn(`[sync] server rejected ${rejectedCount} record(s); they stay pending`, body.rejected)
    }
  }

  // ── Pull ────────────────────────────────────────────────────────────────────

  async pull(token: string): Promise<void> {
    const since = localStorage.getItem(LAST_SYNCED_KEY) ?? '1970-01-01T00:00:00.000Z'

    const res = await fetch(`/api/sync/pull?since=${encodeURIComponent(since)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error(`Pull failed: ${res.status}`)

    const data: SyncPullResponse = await res.json()

    await localDb.transaction(
      'rw',
      [
        localDb.teachers, localDb.students, localDb.subjects, localDb.classes,
        localDb.schedules, localDb.grades, localDb.attendances,
        localDb.weeklyPlans, localDb.weeklyPlanEntries,
        localDb.conductNotes, localDb.contactLogs, localDb.assessments,
      ],
      async () => {
        // Teachers are read-only on the client — always take server version
        if (data.teachers.length > 0) {
          await localDb.teachers.bulkPut(data.teachers.map(t => ({
            id:        t.id as string,
            email:     t.email as string,
            role:      t.role as 'admin' | 'teacher',
            firstName: t.firstName as string,
            lastName:  t.lastName as string,
            updatedAt: t.updatedAt,
          })))
        }

        await this.mergeTable('students',          data.students)
        await this.mergeTable('subjects',          data.subjects)
        await this.mergeTable('classes',           data.classes)
        await this.mergeTable('schedules',         data.schedules)
        await this.mergeTable('grades',            data.grades)
        await this.mergeTable('attendances',       data.attendances)
        await this.mergeTable('weeklyPlans',       data.weeklyPlans)
        await this.mergeTable('weeklyPlanEntries', data.weeklyPlanEntries)
        await this.mergeTable('conductNotes',      data.conductNotes)
        await this.mergeTable('contactLogs',       data.contactLogs)
        await this.mergeTable('assessments',       data.assessments)
      }
    )

    // Prefer the server's own timestamp. Stamping this with the client clock
    // means any skew (or anything written server-side while this request was
    // running) falls into a window that is never requested again, and those
    // records simply never arrive.
    localStorage.setItem(LAST_SYNCED_KEY, data.syncedAt ?? new Date().toISOString())
  }

  // ── Merge (LWW) ─────────────────────────────────────────────────────────────

  private async mergeTable(table: SyncTable, records: ServerRecord[]): Promise<void> {
    if (records.length === 0) return

    const dexieTable = localDb[table] as AnySyncTable
    const existing = await dexieTable.bulkGet(records.map(r => r.id))
    const toUpsert: SyncedRow[] = []

    for (let i = 0; i < records.length; i++) {
      const server = records[i]
      const local  = existing[i]

      if (local?.syncStatus === 'pending' && !isNewer(server.updatedAt, local.updatedAt)) {
        continue // keep the newer local pending write
      }

      toUpsert.push({ ...server, syncStatus: 'synced' } as SyncedRow)
    }

    if (toUpsert.length > 0) {
      await dexieTable.bulkPut(toUpsert)
    }
  }

  // ── sync (push then pull) ───────────────────────────────────────────────────

  async sync(token: string): Promise<void> {
    await this.push(token)
    await this.pull(token)
  }
}

export const syncEngine = new SyncEngine()
