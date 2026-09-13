import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core'

// PostgreSQL schema — used by the API (server-side only).
// Never send passwordHash to clients via PowerSync sync rules.

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<'admin' | 'teacher'>().notNull().default('teacher'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const subjects = pgTable('subjects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  description: text('description'),
  teacherId: text('teacher_id').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})

export const classes = pgTable('classes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gradeLevel: text('grade_level').notNull(),
  academicYear: text('academic_year').notNull(),
  // Owning teacher — see LocalClass in apps/web/src/lib/local-db.ts for the
  // full rationale. Nullable: classes that existed before ownership was
  // introduced have no owner and are admin-only until assigned.
  teacherId: text('teacher_id').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})

export const students = pgTable('students', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  dateOfBirth: text('date_of_birth'),
  phone: text('phone'),
  parentName: text('parent_name'),
  parentPhone: text('parent_phone'),
  parentEmail: text('parent_email'),
  address: text('address'),
  notes: text('notes'),
  classId: text('class_id').references(() => classes.id),
  enrolledAt: timestamp('enrolled_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})

export const grades = pgTable('grades', {
  id:        text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  classId:   text('class_id').notNull().references(() => classes.id),
  term:      text('term').notNull(),                              // e.g. "Term 1"
  score:     integer('score').notNull(),                          // 1–5
  teacherId: text('teacher_id').notNull().references(() => users.id),
  notes:     text('notes'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})

export const weeklyPlans = pgTable('weekly_plans', {
  id:        text('id').primaryKey(),
  classId:   text('class_id').notNull().references(() => classes.id),
  teacherId: text('teacher_id').notNull().references(() => users.id),
  weekStart: text('week_start').notNull(),            // 'YYYY-MM-DD' Monday of the week
  notes:     text('notes'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})

export const weeklyPlanEntries = pgTable('weekly_plan_entries', {
  id:         text('id').primaryKey(),
  planId:     text('plan_id').notNull().references(() => weeklyPlans.id),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id),
  date:       text('date').notNull(),                 // 'YYYY-MM-DD' of the specific lesson day
  topic:      text('topic'),
  objectives: text('objectives'),
  activities: text('activities'),
  homework:   text('homework'),
  updatedAt:  timestamp('updated_at').notNull().defaultNow(),
  deletedAt:  timestamp('deleted_at'),
})

export const attendances = pgTable('attendances', {
  id:         text('id').primaryKey(),
  studentId:  text('student_id').notNull().references(() => students.id),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id),
  date:       text('date').notNull(),                                    // ISO date 'YYYY-MM-DD'
  status:     text('status').$type<'absent' | 'excused'>().notNull(),
  notes:      text('notes'),
  teacherId:  text('teacher_id').notNull().references(() => users.id),
  updatedAt:  timestamp('updated_at').notNull().defaultNow(),
  deletedAt:  timestamp('deleted_at'),
})

export const assessments = pgTable('assessments', {
  id:        text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  classId:   text('class_id').notNull().references(() => classes.id),
  teacherId: text('teacher_id').notNull().references(() => users.id),
  title:     text('title').notNull(),
  type:      text('type').$type<'quiz' | 'test' | 'exam' | 'homework' | 'other'>().notNull(),
  score:     integer('score').notNull(),     // 0–maxScore
  maxScore:  integer('max_score').notNull(), // default 100
  date:      text('date').notNull(),         // 'YYYY-MM-DD'
  notes:     text('notes'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})

export const conductNotes = pgTable('conduct_notes', {
  id:        text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id),
  teacherId: text('teacher_id').notNull().references(() => users.id),
  date:      text('date').notNull(),            // 'YYYY-MM-DD'
  category:  text('category').$type<'positive' | 'concern' | 'neutral'>().notNull(),
  note:      text('note').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})

export const contactLogs = pgTable('contact_logs', {
  id:        text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id),
  teacherId: text('teacher_id').notNull().references(() => users.id),
  date:      text('date').notNull(),            // 'YYYY-MM-DD'
  method:    text('method').$type<'phone' | 'email' | 'meeting' | 'other'>().notNull(),
  topic:     text('topic').notNull(),
  outcome:   text('outcome'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})

export const schedules = pgTable('schedules', {
  id: text('id').primaryKey(),
  classId: text('class_id').notNull().references(() => classes.id),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  teacherId: text('teacher_id').notNull().references(() => users.id),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
})
