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
  // Salted hash of the local sign-in password (`saltHex:hashHex`). Absent for
  // records created before local-only auth existed.
  passwordHash?: string
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
  scheduleId: string
  date: string          // 'YYYY-MM-DD'
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
    // v7 indexes teacher email for local-only sign-in lookups
    this.version(7).stores({
      teachers: 'id, email, role, updatedAt',
    })
  }
}

export const localDb = new LocalDatabase()
