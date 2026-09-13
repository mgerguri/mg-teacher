import { FastifyInstance } from 'fastify'
import { gt, lt, and, eq, inArray } from 'drizzle-orm'
import { db } from '../db.js'
import { pg } from '@mg-teacher/db'

const { users, students, subjects, classes, schedules, grades, attendances, weeklyPlans, weeklyPlanEntries, conductNotes, contactLogs, assessments } = pg

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyncRecord {
  id: string
  updatedAt: string
  deletedAt?: string
  [key: string]: unknown
}

interface PushBody {
  students?:          SyncRecord[]
  subjects?:          SyncRecord[]
  classes?:           SyncRecord[]
  schedules?:         SyncRecord[]
  grades?:            SyncRecord[]
  attendances?:       SyncRecord[]
  weeklyPlans?:       SyncRecord[]
  weeklyPlanEntries?: SyncRecord[]
  conductNotes?:      SyncRecord[]
  contactLogs?:       SyncRecord[]
  assessments?:       SyncRecord[]
}

interface AuthPayload {
  sub:  string
  role: 'admin' | 'teacher'
}

// ── Routes ────────────────────────────────────────────────────────────────────
//
// A class belongs to exactly one teacher (classes.teacherId); everything
// under it — students, grades, attendance, schedules, weekly plans,
// assessments — is only visible to (and writable by) that teacher or an
// admin. Subjects follow the same rule via their own teacherId. This is the
// real enforcement point: apps/web/src/lib/scope.ts applies the identical
// rule client-side, but that's UI convenience only — a hand-crafted request
// to these endpoints has to be stopped here.

export async function syncRoutes(app: FastifyInstance) {

  // ── Pull ─────────────────────────────────────────────────────────────────────
  // Returns all records updated after ?since=<ISO timestamp>.
  // The client uses this to refresh its local IndexedDB.

  app.get<{ Querystring: { since: string } }>(
    '/api/sync/pull',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const since = new Date(req.query.since ?? '1970-01-01')
      if (isNaN(since.getTime())) {
        return reply.status(400).send({ error: 'Invalid since parameter' })
      }

      const { sub: userId, role } = req.user as AuthPayload
      const isAdmin = role === 'admin'

      let classIds: string[] = []
      let ownedScheduleIds = new Set<string>()
      let ownedStudentIds  = new Set<string>()
      let ownedPlanIds     = new Set<string>()

      if (!isAdmin) {
        const ownedClasses = await db.select({ id: classes.id }).from(classes).where(eq(classes.teacherId, userId))
        classIds = ownedClasses.map(c => c.id)

        if (classIds.length > 0) {
          const [scheduleRows, studentRows, planRows] = await Promise.all([
            db.select({ id: schedules.id }).from(schedules).where(inArray(schedules.classId, classIds)),
            db.select({ id: students.id }).from(students).where(inArray(students.classId, classIds)),
            db.select({ id: weeklyPlans.id }).from(weeklyPlans).where(inArray(weeklyPlans.classId, classIds)),
          ])
          ownedScheduleIds = new Set(scheduleRows.map(r => r.id))
          ownedStudentIds  = new Set(studentRows.map(r => r.id))
          ownedPlanIds     = new Set(planRows.map(r => r.id))
        }
      }

      const [
        pulledTeachers, pulledStudents, pulledSubjects, pulledClasses, pulledSchedules,
        pulledGrades, pulledAttendancesRaw, pulledWeeklyPlans, pulledWeeklyPlanEntriesRaw,
        pulledConductNotesRaw, pulledContactLogsRaw, pulledAssessments,
      ] = await Promise.all([
        db.select({
          id:        users.id,
          email:     users.email,
          role:      users.role,
          firstName: users.firstName,
          lastName:  users.lastName,
          updatedAt: users.updatedAt,
        }).from(users).where(gt(users.updatedAt, since)),

        isAdmin
          ? db.select().from(students).where(gt(students.updatedAt, since))
          : classIds.length ? db.select().from(students).where(and(gt(students.updatedAt, since), inArray(students.classId, classIds))) : Promise.resolve([]),

        isAdmin
          ? db.select().from(subjects).where(gt(subjects.updatedAt, since))
          : db.select().from(subjects).where(and(gt(subjects.updatedAt, since), eq(subjects.teacherId, userId))),

        isAdmin
          ? db.select().from(classes).where(gt(classes.updatedAt, since))
          : db.select().from(classes).where(and(gt(classes.updatedAt, since), eq(classes.teacherId, userId))),

        isAdmin
          ? db.select().from(schedules).where(gt(schedules.updatedAt, since))
          : classIds.length ? db.select().from(schedules).where(and(gt(schedules.updatedAt, since), inArray(schedules.classId, classIds))) : Promise.resolve([]),

        isAdmin
          ? db.select().from(grades).where(gt(grades.updatedAt, since))
          : classIds.length ? db.select().from(grades).where(and(gt(grades.updatedAt, since), inArray(grades.classId, classIds))) : Promise.resolve([]),

        // attendances/weeklyPlanEntries/conductNotes/contactLogs don't carry
        // a classId directly — pulled by time only, then post-filtered below
        // using the owned schedule/plan/student id sets computed above.
        db.select().from(attendances).where(gt(attendances.updatedAt, since)),

        isAdmin
          ? db.select().from(weeklyPlans).where(gt(weeklyPlans.updatedAt, since))
          : classIds.length ? db.select().from(weeklyPlans).where(and(gt(weeklyPlans.updatedAt, since), inArray(weeklyPlans.classId, classIds))) : Promise.resolve([]),

        db.select().from(weeklyPlanEntries).where(gt(weeklyPlanEntries.updatedAt, since)),
        db.select().from(conductNotes).where(gt(conductNotes.updatedAt, since)),
        db.select().from(contactLogs).where(gt(contactLogs.updatedAt, since)),

        isAdmin
          ? db.select().from(assessments).where(gt(assessments.updatedAt, since))
          : classIds.length ? db.select().from(assessments).where(and(gt(assessments.updatedAt, since), inArray(assessments.classId, classIds))) : Promise.resolve([]),
      ])

      const pulledAttendances       = isAdmin ? pulledAttendancesRaw       : pulledAttendancesRaw.filter(a => ownedScheduleIds.has(a.scheduleId))
      const pulledWeeklyPlanEntries = isAdmin ? pulledWeeklyPlanEntriesRaw : pulledWeeklyPlanEntriesRaw.filter(e => ownedPlanIds.has(e.planId))
      const pulledConductNotes      = isAdmin ? pulledConductNotesRaw      : pulledConductNotesRaw.filter(n => ownedStudentIds.has(n.studentId))
      const pulledContactLogs       = isAdmin ? pulledContactLogsRaw       : pulledContactLogsRaw.filter(l => ownedStudentIds.has(l.studentId))

      return reply.send({
        teachers:          pulledTeachers,
        students:          pulledStudents,
        subjects:          pulledSubjects,
        classes:           pulledClasses,
        schedules:         pulledSchedules,
        grades:            pulledGrades,
        attendances:       pulledAttendances,
        weeklyPlans:       pulledWeeklyPlans,
        weeklyPlanEntries: pulledWeeklyPlanEntries,
        conductNotes:      pulledConductNotes,
        contactLogs:       pulledContactLogs,
        assessments:       pulledAssessments,
      })
    }
  )

  // ── Push ─────────────────────────────────────────────────────────────────────
  // Accepts batches of locally-mutated records and upserts them into Postgres.
  // Last-write-wins: only update if incoming updatedAt >= the stored updatedAt.
  // This is enforced in the WHERE clause of each ON CONFLICT ... DO UPDATE.

  app.post<{ Body: PushBody }>(
    '/api/sync/push',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const { sub: userId, role } = req.user as AuthPayload
      const isAdmin = role === 'admin'

      const {
        students: s = [], subjects: su = [], classes: cl = [], schedules: sc = [],
        grades: gr = [], attendances: at = [], weeklyPlans: wp = [], weeklyPlanEntries: wpe = [],
        conductNotes: cn = [], contactLogs: clog = [], assessments: asmt = [],
      } = req.body

      let students_ = s, subjects_ = su, classes_ = cl, schedules_ = sc, grades_ = gr
      let attendances_ = at, weeklyPlans_ = wp, weeklyPlanEntries_ = wpe
      let conductNotes_ = cn, contactLogs_ = clog, assessments_ = asmt

      if (!isAdmin) {
        // Non-admins can only own classes/subjects as themselves. Checking
        // only the *incoming* teacherId isn't enough — that alone would let
        // someone "steal" an existing class/subject (or any other record
        // below) by re-pushing its known id with themselves as owner, so
        // filterOwned also requires whatever the row's owner already was in
        // the DB (if it exists at all) to already be the requester.
        classes_  = await filterOwned(cl, classes,  'teacherId', v => v === userId)
        subjects_ = await filterOwned(su, subjects, 'teacherId', v => v === userId)

        // Ownership includes what's already in the DB *and* what's being
        // validly self-created in this same batch — a class and its
        // schedule/students/etc are often pushed together after working
        // offline, before the class exists server-side yet.
        const dbOwnedClasses = await db.select({ id: classes.id }).from(classes).where(eq(classes.teacherId, userId))
        const ownedClassIds = new Set([...dbOwnedClasses.map(c => c.id), ...classes_.map(c => c.id)])
        const isOwnedClass = (v: string) => ownedClassIds.has(v)

        students_    = await filterOwned(s,    students,    'classId', isOwnedClass)
        schedules_   = await filterOwned(sc,   schedules,   'classId', isOwnedClass)
        grades_      = await filterOwned(gr,   grades,      'classId', isOwnedClass)
        weeklyPlans_ = await filterOwned(wp,   weeklyPlans, 'classId', isOwnedClass)
        assessments_ = await filterOwned(asmt, assessments, 'classId', isOwnedClass)

        const idsArr = [...ownedClassIds]
        const [dbOwnedSchedules, dbOwnedStudents, dbOwnedPlans] = idsArr.length
          ? await Promise.all([
              db.select({ id: schedules.id }).from(schedules).where(inArray(schedules.classId, idsArr)),
              db.select({ id: students.id }).from(students).where(inArray(students.classId, idsArr)),
              db.select({ id: weeklyPlans.id }).from(weeklyPlans).where(inArray(weeklyPlans.classId, idsArr)),
            ])
          : [[], [], []]

        const ownedScheduleIds = new Set([...dbOwnedSchedules.map(r => r.id), ...schedules_.map(r => r.id)])
        const ownedStudentIds  = new Set([...dbOwnedStudents.map(r => r.id),  ...students_.map(r => r.id)])
        const ownedPlanIds     = new Set([...dbOwnedPlans.map(r => r.id),     ...weeklyPlans_.map(r => r.id)])

        attendances_       = await filterOwned(at,  attendances,       'scheduleId', v => ownedScheduleIds.has(v))
        conductNotes_      = await filterOwned(cn,  conductNotes,      'studentId',  v => ownedStudentIds.has(v))
        contactLogs_       = await filterOwned(clog, contactLogs,      'studentId',  v => ownedStudentIds.has(v))
        weeklyPlanEntries_ = await filterOwned(wpe, weeklyPlanEntries, 'planId',     v => ownedPlanIds.has(v))
      }

      // Staged in FK dependency order — a class and everything under it
      // (students, schedules, grades, plans, attendance…) is typically
      // pushed together in one batch after working offline, and running
      // every upsert concurrently would insert e.g. a student before the
      // class it references exists yet.
      await Promise.all([upsertClasses(classes_), upsertSubjects(subjects_)])
      await Promise.all([upsertStudents(students_), upsertSchedules(schedules_)])
      await Promise.all([
        upsertGrades(grades_),
        upsertWeeklyPlans(weeklyPlans_),
        upsertConductNotes(conductNotes_),
        upsertContactLogs(contactLogs_),
        upsertAssessments(assessments_),
      ])
      await Promise.all([upsertAttendances(attendances_), upsertWeeklyPlanEntries(weeklyPlanEntries_)])

      return reply.send({ ok: true })
    }
  )
}

// ── Ownership filter ──────────────────────────────────────────────────────────
// Keeps only records where `isOwned(record[fkColumn])` holds for BOTH the
// incoming value and — if a row with that id already exists — whatever that
// column's value already was in the DB. Checking the incoming value alone
// would let a request "steal" an existing row (any table below) by
// re-pushing its id with an owned value in that column; checking prior
// state alone wouldn't stop writing a brand new row into someone else's
// scope. `table` needs an `id` column and a column named `fkColumn`.

async function filterOwned<T extends SyncRecord>(
  records: T[],
  table: any,
  fkColumn: string,
  isOwned: (value: string) => boolean
): Promise<T[]> {
  if (!records.length) return []

  const ids = records.map(r => r.id)
  const existing = await db
    .select({ id: table.id, fk: table[fkColumn] })
    .from(table)
    .where(inArray(table.id, ids))
  const existingBysId = new Map(existing.map((e: any) => [e.id as string, e.fk as string | null]))

  return records.filter(r => {
    const incoming = r[fkColumn] as string | undefined
    if (typeof incoming !== 'string' || !isOwned(incoming)) return false
    const prior = existingBysId.get(r.id)
    if (prior !== undefined && prior !== null && !isOwned(prior)) return false
    return true
  })
}

// ── Upsert helpers (last-write-wins) ─────────────────────────────────────────

async function upsertStudents(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    const fields = {
      firstName:   r.firstName   as string,
      lastName:    r.lastName    as string,
      email:       r.email       as string | undefined,
      dateOfBirth: r.dateOfBirth as string | undefined,
      phone:       r.phone       as string | undefined,
      parentName:  r.parentName  as string | undefined,
      parentPhone: r.parentPhone as string | undefined,
      parentEmail: r.parentEmail as string | undefined,
      address:     r.address     as string | undefined,
      notes:       r.notes       as string | undefined,
      classId:     r.classId     as string | undefined,
      updatedAt:   new Date(r.updatedAt),
      deletedAt:   r.deletedAt ? new Date(r.deletedAt as string) : null,
    }
    await db.insert(students).values({
      id: r.id,
      enrolledAt: r.enrolledAt ? new Date(r.enrolledAt as string) : new Date(),
      ...fields,
    }).onConflictDoUpdate({
      target: students.id,
      set: fields,
      setWhere: lt(students.updatedAt, new Date(r.updatedAt)),
    })
  }
}

async function upsertSubjects(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    await db.insert(subjects).values({
      id:          r.id,
      name:        r.name as string,
      code:        r.code as string,
      description: r.description as string | undefined,
      teacherId:   r.teacherId as string | undefined,
      updatedAt:   new Date(r.updatedAt),
      deletedAt:   r.deletedAt ? new Date(r.deletedAt as string) : null,
    }).onConflictDoUpdate({
      target: subjects.id,
      set: {
        name:        r.name as string,
        code:        r.code as string,
        description: r.description as string | undefined,
        teacherId:   r.teacherId as string | undefined,
        updatedAt:   new Date(r.updatedAt),
        deletedAt:   r.deletedAt ? new Date(r.deletedAt as string) : null,
      },
      setWhere: lt(subjects.updatedAt, new Date(r.updatedAt)),
    })
  }
}

async function upsertClasses(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    await db.insert(classes).values({
      id:           r.id,
      name:         r.name as string,
      gradeLevel:   r.gradeLevel as string,
      academicYear: r.academicYear as string,
      teacherId:    r.teacherId as string | undefined,
      updatedAt:    new Date(r.updatedAt),
      deletedAt:    r.deletedAt ? new Date(r.deletedAt as string) : null,
    }).onConflictDoUpdate({
      target: classes.id,
      set: {
        name:         r.name as string,
        gradeLevel:   r.gradeLevel as string,
        academicYear: r.academicYear as string,
        teacherId:    r.teacherId as string | undefined,
        updatedAt:    new Date(r.updatedAt),
        deletedAt:    r.deletedAt ? new Date(r.deletedAt as string) : null,
      },
      setWhere: lt(classes.updatedAt, new Date(r.updatedAt)),
    })
  }
}

async function upsertSchedules(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    await db.insert(schedules).values({
      id:         r.id,
      classId:    r.classId as string,
      subjectId:  r.subjectId as string,
      teacherId:  r.teacherId as string,
      dayOfWeek:  r.dayOfWeek as number,
      startTime:  r.startTime as string,
      endTime:    r.endTime as string,
      updatedAt:  new Date(r.updatedAt),
      deletedAt:  r.deletedAt ? new Date(r.deletedAt as string) : null,
    }).onConflictDoUpdate({
      target: schedules.id,
      set: {
        classId:   r.classId as string,
        subjectId: r.subjectId as string,
        teacherId: r.teacherId as string,
        dayOfWeek: r.dayOfWeek as number,
        startTime: r.startTime as string,
        endTime:   r.endTime as string,
        updatedAt: new Date(r.updatedAt),
        deletedAt: r.deletedAt ? new Date(r.deletedAt as string) : null,
      },
      setWhere: lt(schedules.updatedAt, new Date(r.updatedAt)),
    })
  }
}

async function upsertGrades(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    const fields = {
      studentId: r.studentId as string,
      subjectId: r.subjectId as string,
      classId:   r.classId as string,
      term:      r.term as string,
      score:     r.score as number,
      teacherId: r.teacherId as string,
      notes:     r.notes as string | undefined,
      updatedAt: new Date(r.updatedAt),
      deletedAt: r.deletedAt ? new Date(r.deletedAt as string) : null,
    }
    await db.insert(grades).values({ id: r.id, ...fields })
      .onConflictDoUpdate({
        target: grades.id,
        set: fields,
        setWhere: lt(grades.updatedAt, new Date(r.updatedAt)),
      })
  }
}

async function upsertAttendances(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    const fields = {
      studentId:  r.studentId  as string,
      scheduleId: r.scheduleId as string,
      date:       r.date       as string,
      status:     r.status     as 'absent' | 'excused',
      notes:      r.notes      as string | undefined,
      teacherId:  r.teacherId  as string,
      updatedAt:  new Date(r.updatedAt),
      deletedAt:  r.deletedAt ? new Date(r.deletedAt as string) : null,
    }
    await db.insert(attendances).values({ id: r.id, ...fields })
      .onConflictDoUpdate({
        target: attendances.id,
        set: fields,
        setWhere: lt(attendances.updatedAt, new Date(r.updatedAt)),
      })
  }
}

async function upsertWeeklyPlans(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    const fields = {
      classId:   r.classId   as string,
      teacherId: r.teacherId as string,
      weekStart: r.weekStart as string,
      notes:     r.notes     as string | undefined,
      updatedAt: new Date(r.updatedAt),
      deletedAt: r.deletedAt ? new Date(r.deletedAt as string) : null,
    }
    await db.insert(weeklyPlans).values({ id: r.id, ...fields })
      .onConflictDoUpdate({
        target: weeklyPlans.id,
        set: fields,
        setWhere: lt(weeklyPlans.updatedAt, new Date(r.updatedAt)),
      })
  }
}

async function upsertWeeklyPlanEntries(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    const fields = {
      planId:     r.planId     as string,
      scheduleId: r.scheduleId as string,
      date:       r.date       as string,
      topic:      r.topic      as string | undefined,
      objectives: r.objectives as string | undefined,
      activities: r.activities as string | undefined,
      homework:   r.homework   as string | undefined,
      updatedAt:  new Date(r.updatedAt),
      deletedAt:  r.deletedAt ? new Date(r.deletedAt as string) : null,
    }
    await db.insert(weeklyPlanEntries).values({ id: r.id, ...fields })
      .onConflictDoUpdate({
        target: weeklyPlanEntries.id,
        set: fields,
        setWhere: lt(weeklyPlanEntries.updatedAt, new Date(r.updatedAt)),
      })
  }
}

async function upsertConductNotes(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    const fields = {
      studentId: r.studentId as string,
      teacherId: r.teacherId as string,
      date:      r.date      as string,
      category:  r.category  as 'positive' | 'concern' | 'neutral',
      note:      r.note      as string,
      updatedAt: new Date(r.updatedAt),
      deletedAt: r.deletedAt ? new Date(r.deletedAt as string) : null,
    }
    await db.insert(conductNotes).values({ id: r.id, ...fields })
      .onConflictDoUpdate({
        target: conductNotes.id,
        set: fields,
        setWhere: lt(conductNotes.updatedAt, new Date(r.updatedAt)),
      })
  }
}

async function upsertContactLogs(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    const fields = {
      studentId: r.studentId as string,
      teacherId: r.teacherId as string,
      date:      r.date      as string,
      method:    r.method    as 'phone' | 'email' | 'meeting' | 'other',
      topic:     r.topic     as string,
      outcome:   r.outcome   as string | undefined,
      updatedAt: new Date(r.updatedAt),
      deletedAt: r.deletedAt ? new Date(r.deletedAt as string) : null,
    }
    await db.insert(contactLogs).values({ id: r.id, ...fields })
      .onConflictDoUpdate({
        target: contactLogs.id,
        set: fields,
        setWhere: lt(contactLogs.updatedAt, new Date(r.updatedAt)),
      })
  }
}

async function upsertAssessments(records: SyncRecord[]) {
  if (!records.length) return
  for (const r of records) {
    const fields = {
      studentId: r.studentId as string,
      subjectId: r.subjectId as string,
      classId:   r.classId   as string,
      teacherId: r.teacherId as string,
      title:     r.title     as string,
      type:      r.type      as 'quiz' | 'test' | 'exam' | 'homework' | 'other',
      score:     r.score     as number,
      maxScore:  r.maxScore  as number,
      date:      r.date      as string,
      notes:     r.notes     as string | undefined,
      updatedAt: new Date(r.updatedAt),
      deletedAt: r.deletedAt ? new Date(r.deletedAt as string) : null,
    }
    await db.insert(assessments).values({ id: r.id, ...fields })
      .onConflictDoUpdate({
        target: assessments.id,
        set: fields,
        setWhere: lt(assessments.updatedAt, new Date(r.updatedAt)),
      })
  }
}
