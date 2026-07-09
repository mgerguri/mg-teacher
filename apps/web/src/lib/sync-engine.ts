import Dexie from 'dexie'
import { localDb, SyncStatus } from './local-db'

const LAST_SYNCED_KEY = 'mg_teacher_last_synced_at'

// ── Types matching what the API returns ───────────────────────────────────────

interface SyncPullResponse {
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

// Returns true if incoming record is newer than what we have locally.
function isNewer(incoming: string, existing: string | undefined): boolean {
  if (!existing) return true
  return new Date(incoming) >= new Date(existing)
}

// ── Sync engine ───────────────────────────────────────────────────────────────

export class SyncEngine {
  // ── Push ────────────────────────────────────────────────────────────────────

  async push(token: string): Promise<void> {
    const [students, subjects, classes, schedules, grades, attendances, weeklyPlans, weeklyPlanEntries, conductNotes, contactLogs, assessments] = await Promise.all([
      localDb.students.where('syncStatus').equals('pending').toArray(),
      localDb.subjects.where('syncStatus').equals('pending').toArray(),
      localDb.classes.where('syncStatus').equals('pending').toArray(),
      localDb.schedules.where('syncStatus').equals('pending').toArray(),
      localDb.grades.where('syncStatus').equals('pending').toArray(),
      localDb.attendances.where('syncStatus').equals('pending').toArray(),
      localDb.weeklyPlans.where('syncStatus').equals('pending').toArray(),
      localDb.weeklyPlanEntries.where('syncStatus').equals('pending').toArray(),
      localDb.conductNotes.where('syncStatus').equals('pending').toArray(),
      localDb.contactLogs.where('syncStatus').equals('pending').toArray(),
      localDb.assessments.where('syncStatus').equals('pending').toArray(),
    ])

    const hasPending = [students, subjects, classes, schedules, grades, attendances, weeklyPlans, weeklyPlanEntries, conductNotes, contactLogs, assessments]
      .reduce((n, arr) => n + arr.length, 0) > 0
    if (!hasPending) return

    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ students, subjects, classes, schedules, grades, attendances, weeklyPlans, weeklyPlanEntries, conductNotes, contactLogs, assessments }),
    })

    if (!res.ok) throw new Error(`Push failed: ${res.status}`)

    await localDb.transaction('rw', [
      localDb.students, localDb.subjects, localDb.classes, localDb.schedules,
      localDb.grades, localDb.attendances, localDb.weeklyPlans, localDb.weeklyPlanEntries,
      localDb.conductNotes, localDb.contactLogs, localDb.assessments,
    ], async () => {
      for (const s of students)          await localDb.students.update(s.id,          { syncStatus: 'synced' })
      for (const s of subjects)          await localDb.subjects.update(s.id,          { syncStatus: 'synced' })
      for (const c of classes)           await localDb.classes.update(c.id,           { syncStatus: 'synced' })
      for (const s of schedules)         await localDb.schedules.update(s.id,         { syncStatus: 'synced' })
      for (const g of grades)            await localDb.grades.update(g.id,            { syncStatus: 'synced' })
      for (const a of attendances)       await localDb.attendances.update(a.id,       { syncStatus: 'synced' })
      for (const p of weeklyPlans)       await localDb.weeklyPlans.update(p.id,       { syncStatus: 'synced' })
      for (const e of weeklyPlanEntries) await localDb.weeklyPlanEntries.update(e.id, { syncStatus: 'synced' })
      for (const n of conductNotes)      await localDb.conductNotes.update(n.id,      { syncStatus: 'synced' })
      for (const l of contactLogs)       await localDb.contactLogs.update(l.id,       { syncStatus: 'synced' })
      for (const a of assessments)       await localDb.assessments.update(a.id,       { syncStatus: 'synced' })
    })
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

    localStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString())
  }

  // ── Merge (LWW) ─────────────────────────────────────────────────────────────

  private async mergeTable(
    table: 'students' | 'subjects' | 'classes' | 'schedules' | 'grades' | 'attendances' | 'weeklyPlans' | 'weeklyPlanEntries' | 'conductNotes' | 'contactLogs' | 'assessments',
    records: ServerRecord[]
  ): Promise<void> {
    if (records.length === 0) return

    const dexieTable = localDb[table] as Dexie.Table<{ id: string; updatedAt: string; syncStatus: SyncStatus }>
    const existing = await dexieTable.bulkGet(records.map(r => r.id))
    const toUpsert: object[] = []

    for (let i = 0; i < records.length; i++) {
      const server = records[i]
      const local  = existing[i]

      if (local?.syncStatus === 'pending' && !isNewer(server.updatedAt, local.updatedAt)) {
        continue // keep the newer local pending write
      }

      toUpsert.push({ ...server, syncStatus: 'synced' })
    }

    if (toUpsert.length > 0) {
      await (dexieTable as any).bulkPut(toUpsert)
    }
  }

  // ── sync (push then pull) ───────────────────────────────────────────────────

  async sync(token: string): Promise<void> {
    await this.push(token)
    await this.pull(token)
  }
}

export const syncEngine = new SyncEngine()
