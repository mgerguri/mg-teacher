import { sql } from 'drizzle-orm'
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core'

// Using SQLite column types — Drizzle maps these to Postgres equivalents
// when targeting the server via pg adapter.

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'teacher'] }).notNull().default('teacher'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const teachers = sqliteTable('teachers', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  syncStatus: text('sync_status').notNull().default('pending'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
})

export const subjects = sqliteTable('subjects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  description: text('description'),
  teacherId: text('teacher_id').references(() => teachers.id),
  syncStatus: text('sync_status').notNull().default('pending'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
})

export const classes = sqliteTable('classes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  gradeLevel: text('grade_level').notNull(),
  academicYear: text('academic_year').notNull(),
  syncStatus: text('sync_status').notNull().default('pending'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
})

export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  dateOfBirth: text('date_of_birth'),
  classId: text('class_id').references(() => classes.id),
  enrolledAt: text('enrolled_at').notNull().default(sql`(datetime('now'))`),
  syncStatus: text('sync_status').notNull().default('pending'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
})

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  classId: text('class_id').notNull().references(() => classes.id),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  teacherId: text('teacher_id').notNull().references(() => teachers.id),
  dayOfWeek: integer('day_of_week').notNull(), // 0=Sun … 6=Sat
  startTime: text('start_time').notNull(),     // "HH:MM"
  endTime: text('end_time').notNull(),
  syncStatus: text('sync_status').notNull().default('pending'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  deletedAt: text('deleted_at'),
})
