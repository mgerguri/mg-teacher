// ─── Core entities ────────────────────────────────────────────────────────────

export interface Student {
  id: string
  firstName: string
  lastName: string
  email?: string
  dateOfBirth?: string
  enrolledAt: string
  classId?: string
}

export interface Subject {
  id: string
  name: string
  code: string
  description?: string
  teacherId: string
}

export interface Class {
  id: string
  name: string
  gradeLevel: string
  academicYear: string
  subjectIds: string[]
}

export interface Schedule {
  id: string
  classId: string
  subjectId: string
  teacherId: string
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  startTime: string // "HH:MM"
  endTime: string   // "HH:MM"
}

export interface Teacher {
  id: string
  firstName: string
  lastName: string
  email: string
  subjectIds: string[]
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'pending' | 'synced' | 'conflict'

export interface SyncMeta {
  syncStatus: SyncStatus
  updatedAt: string
  deletedAt?: string
}
