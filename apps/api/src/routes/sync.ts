import { FastifyInstance } from 'fastify'
import { gt } from 'drizzle-orm'
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

// ── Routes ────────────────────────────────────────────────────────────────────

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

      const [pulledTeachers, pulledStudents, pulledSubjects, pulledClasses, pulledSchedules, pulledGrades, pulledAttendances, pulledWeeklyPlans, pulledWeeklyPlanEntries, pulledConductNotes, pulledContactLogs, pulledAssessments] = await Promise.all([
        db.select({
          id:        users.id,
          email:     users.email,
          role:      users.role,
          firstName: users.firstName,
          lastName:  users.lastName,
          updatedAt: users.updatedAt,
        }).from(users).where(gt(users.updatedAt, since)),
        db.select().from(students).where(gt(students.updatedAt, since)),
        db.select().from(subjects).where(gt(subjects.updatedAt, since)),
        db.select().from(classes).where(gt(classes.updatedAt, since)),
        db.select().from(schedules).where(gt(schedules.updatedAt, since)),
        db.select().from(grades).where(gt(grades.updatedAt, since)),
        db.select().from(attendances).where(gt(attendances.updatedAt, since)),
        db.select().from(weeklyPlans).where(gt(weeklyPlans.updatedAt, since)),
        db.select().from(weeklyPlanEntries).where(gt(weeklyPlanEntries.updatedAt, since)),
        db.select().from(conductNotes).where(gt(conductNotes.updatedAt, since)),
        db.select().from(contactLogs).where(gt(contactLogs.updatedAt, since)),
        db.select().from(assessments).where(gt(assessments.updatedAt, since)),
      ])

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
      const {
        students: s = [], subjects: su = [], classes: cl = [], schedules: sc = [],
        grades: gr = [], attendances: at = [], weeklyPlans: wp = [], weeklyPlanEntries: wpe = [],
        conductNotes: cn = [], contactLogs: clog = [], assessments: asmt = [],
      } = req.body

      await Promise.all([
        upsertStudents(s),
        upsertSubjects(su),
        upsertClasses(cl),
        upsertSchedules(sc),
        upsertGrades(gr),
        upsertAttendances(at),
        upsertWeeklyPlans(wp),
        upsertWeeklyPlanEntries(wpe),
        upsertConductNotes(cn),
        upsertContactLogs(clog),
        upsertAssessments(asmt),
      ])

      return reply.send({ ok: true })
    }
  )
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
      setWhere: gt(new Date(r.updatedAt), students.updatedAt),
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
      setWhere: gt(new Date(r.updatedAt), subjects.updatedAt),
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
      updatedAt:    new Date(r.updatedAt),
      deletedAt:    r.deletedAt ? new Date(r.deletedAt as string) : null,
    }).onConflictDoUpdate({
      target: classes.id,
      set: {
        name:         r.name as string,
        gradeLevel:   r.gradeLevel as string,
        academicYear: r.academicYear as string,
        updatedAt:    new Date(r.updatedAt),
        deletedAt:    r.deletedAt ? new Date(r.deletedAt as string) : null,
      },
      setWhere: gt(new Date(r.updatedAt), classes.updatedAt),
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
      setWhere: gt(new Date(r.updatedAt), schedules.updatedAt),
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
        setWhere: gt(new Date(r.updatedAt), grades.updatedAt),
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
        setWhere: gt(new Date(r.updatedAt), attendances.updatedAt),
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
        setWhere: gt(new Date(r.updatedAt), weeklyPlans.updatedAt),
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
        setWhere: gt(new Date(r.updatedAt), weeklyPlanEntries.updatedAt),
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
        setWhere: gt(new Date(r.updatedAt), conductNotes.updatedAt),
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
        setWhere: gt(new Date(r.updatedAt), contactLogs.updatedAt),
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
        setWhere: gt(new Date(r.updatedAt), assessments.updatedAt),
      })
  }
}
