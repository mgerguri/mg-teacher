// Per-teacher data isolation. A class belongs to exactly one teacher
// (LocalClass.teacherId); everything under it — students, grades,
// attendance, schedules, weekly plans, assessments — is only visible to
// that teacher or to an admin. Subjects follow the same rule via their own
// teacherId. Classes/subjects with no owner (pre-existing data, or created
// unassigned by an admin) are admin-only until explicitly assigned.

import type { AuthUser } from '../context/AuthContext'
import type { LocalClass, LocalSubject } from './local-db'

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin'
}

export function scopeClasses(all: LocalClass[], user: AuthUser | null): LocalClass[] {
  if (isAdmin(user)) return all
  return all.filter(c => c.teacherId === user?.id)
}

export function scopeSubjects(all: LocalSubject[], user: AuthUser | null): LocalSubject[] {
  if (isAdmin(user)) return all
  return all.filter(s => s.teacherId === user?.id)
}

export function classIdSet(classes: LocalClass[]): Set<string> {
  return new Set(classes.map(c => c.id))
}

// For rows that carry a classId but aren't already scoped by having been
// fetched for one specific (already-owned) class — e.g. dashboard/search
// aggregates spanning every class at once. Admins pass through unfiltered,
// including rows with no classId at all (unassigned students).
export function scopeByClassId<T extends { classId?: string }>(
  rows: T[],
  user: AuthUser | null,
  ownClassIds: Set<string>
): T[] {
  if (isAdmin(user)) return rows
  return rows.filter(r => r.classId !== undefined && ownClassIds.has(r.classId))
}
