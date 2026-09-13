import Dexie, { Table } from 'dexie'

// ── Local entity types ────────────────────────────────────────────────────────
// These mirror the server schema. `syncStatus` tracks whether local writes
// have been pushed to the server yet.

export type SyncStatus = 'synced' | 'pending'

export interface LocalTeacher {
  id: string
  email: string
  role: 'admin' | 'teacher'
  firstName: string
  lastName: string
  updatedAt: string
}

export interface LocalStudent {
  id: string
  firstName: string
  lastName: string
  email?: string
  dateOfBirth?: string
  phone?: string
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  address?: string
  notes?: string
  classId?: string
  enrolledAt: string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

export interface LocalSubject {
  id: string
  name: string
  code: string
  description?: string
  teacherId?: string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

export interface LocalClass {
  id: string
  name: string
  gradeLevel: string
  academicYear: string
  // Owning teacher — a class (and everything under it: students, grades,
  // attendance, schedules, plans, assessments) is only visible to its owner
  // and to admins. Absent on classes that existed before ownership was
  // introduced; those are admin-only until explicitly assigned.
  teacherId?: string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

export interface LocalSchedule {
  id: string
  classId: string
  subjectId: string
  teacherId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

export interface LocalGrade {
  id: string
  studentId: string
  subjectId: string
  classId: string
  term: string
  score: 1 | 2 | 3 | 4 | 5
  teacherId: string
  notes?: string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

export interface LocalWeeklyPlan {
  id: string
  classId: string
  teacherId: string
  weekStart: string       // 'YYYY-MM-DD' Monday
  notes?: string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

export interface LocalWeeklyPlanEntry {
  id: string
  planId: string
  scheduleId: string
  date: string            // 'YYYY-MM-DD'
  topic?: string
  objectives?: string
  activities?: string
  homework?: string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

export interface LocalAttendance {
  id: string
  studentId: string
  classId: string
  date: string          // 'YYYY-MM-DD'
  // Absence of a record for a given studentId+date means present — attendance
  // is tracked once per day per student, not per class period.
  status: 'absent' | 'excused'
  notes?: string
  teacherId: string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

export interface LocalAssessment {
  id:        string
  studentId: string
  subjectId: string
  classId:   string
  teacherId: string
  title:     string
  type:      'quiz' | 'test' | 'exam' | 'homework' | 'other'
  score:     number
  maxScore:  number
  grade?:    1 | 2 | 3 | 4 | 5
  date:      string  // 'YYYY-MM-DD'
  notes?:    string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

export interface LocalConductNote {
  id:        string
  studentId: string
  teacherId: string
  date:      string   // 'YYYY-MM-DD'
  category:  'positive' | 'concern' | 'neutral'
  note:      string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

export interface LocalContactLog {
  id:        string
  studentId: string
  teacherId: string
  date:      string   // 'YYYY-MM-DD'
  method:    'phone' | 'email' | 'meeting' | 'other'
  topic:     string
  outcome?:  string
  updatedAt: string
  deletedAt?: string
  syncStatus: SyncStatus
}

// ── Database ──────────────────────────────────────────────────────────────────

class LocalDatabase extends Dexie {
  teachers!: Table<LocalTeacher>
  students!: Table<LocalStudent>
  subjects!: Table<LocalSubject>
  classes!: Table<LocalClass>
  schedules!: Table<LocalSchedule>
  grades!: Table<LocalGrade>
  weeklyPlans!: Table<LocalWeeklyPlan>
  weeklyPlanEntries!: Table<LocalWeeklyPlanEntry>
  attendances!: Table<LocalAttendance>
  conductNotes!: Table<LocalConductNote>
  contactLogs!: Table<LocalContactLog>
  assessments!: Table<LocalAssessment>

  constructor() {
    super('mg-teacher')
    this.version(1).stores({
      teachers:  'id, role, updatedAt',
      students:  'id, classId, updatedAt, syncStatus',
      subjects:  'id, teacherId, updatedAt, syncStatus',
      classes:   'id, updatedAt, syncStatus',
      schedules: 'id, classId, subjectId, teacherId, updatedAt, syncStatus',
    })
    this.version(2).stores({
      grades: 'id, studentId, subjectId, classId, term, updatedAt, syncStatus',
    })
    this.version(3).stores({
      attendances: 'id, studentId, scheduleId, date, updatedAt, syncStatus',
    })
    this.version(4).stores({
      weeklyPlans:       'id, classId, teacherId, weekStart, updatedAt, syncStatus',
      weeklyPlanEntries: 'id, planId, scheduleId, date, updatedAt, syncStatus',
    })
    // v5 adds conduct notes + contact logs
    this.version(5).stores({
      conductNotes: 'id, studentId, teacherId, date, updatedAt, syncStatus',
      contactLogs:  'id, studentId, teacherId, date, updatedAt, syncStatus',
    })
    // v6 adds assessments
    this.version(6).stores({
      assessments: 'id, studentId, subjectId, classId, teacherId, date, updatedAt, syncStatus',
    })
    // v7: attendance moves from per-period (scheduleId) to per-day
    // (classId) tracking — one status per student per date, not one per
    // class period. A day that previously had mixed per-period marks (e.g.
    // absent for period 1, excused for period 2) collapses to a single
    // record, keeping the more severe status; the rest are soft-deleted
    // rather than dropped, so summaries don't double-count old data.
    this.version(7).stores({
      attendances: 'id, studentId, classId, date, updatedAt, syncStatus',
    }).upgrade(async tx => {
      const students = await tx.table('students').toArray()
      const classByStudent = new Map(students.map((s: LocalStudent) => [s.id, s.classId]))

      const all = await tx.table('attendances').toArray()
      const now = new Date().toISOString()
      const severity: Record<string, number> = { excused: 1, absent: 2 }

      const keepByKey = new Map<string, LocalAttendance>()
      for (const rec of all as LocalAttendance[]) {
        if (rec.deletedAt) continue
        const key = `${rec.studentId}:${rec.date}`
        const prev = keepByKey.get(key)
        if (!prev || severity[rec.status] > severity[prev.status]) keepByKey.set(key, rec)
      }
      const keptIds = new Set([...keepByKey.values()].map(r => r.id))

      await tx.table('attendances').toCollection().modify((rec: LocalAttendance & { scheduleId?: string }) => {
        rec.classId = classByStudent.get(rec.studentId) ?? ''
        delete rec.scheduleId
        if (!rec.deletedAt && !keptIds.has(rec.id)) {
          rec.deletedAt = now
        }
      })
    })

    // v8 adds per-teacher class ownership — classes.teacherId is now
    // indexed for scoped queries. Existing classes get no owner (see the
    // LocalClass comment); admins can assign one via the class editor.
    this.version(8).stores({
      classes: 'id, teacherId, updatedAt, syncStatus',
    })
  }
}

export const localDb = new LocalDatabase()
