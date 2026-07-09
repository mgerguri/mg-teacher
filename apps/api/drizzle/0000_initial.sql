-- Migration 0000: initial schema
-- All tables that existed before conduct_notes / contact_logs / assessments

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
  "id"            text PRIMARY KEY,
  "email"         text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "role"          text NOT NULL DEFAULT 'teacher',
  "first_name"    text NOT NULL,
  "last_name"     text NOT NULL,
  "created_at"    timestamp NOT NULL DEFAULT now(),
  "updated_at"    timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subjects" (
  "id"          text PRIMARY KEY,
  "name"        text NOT NULL,
  "code"        text NOT NULL,
  "description" text,
  "teacher_id"  text REFERENCES "users"("id"),
  "updated_at"  timestamp NOT NULL DEFAULT now(),
  "deleted_at"  timestamp
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "classes" (
  "id"            text PRIMARY KEY,
  "name"          text NOT NULL,
  "grade_level"   text NOT NULL,
  "academic_year" text NOT NULL,
  "updated_at"    timestamp NOT NULL DEFAULT now(),
  "deleted_at"    timestamp
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "students" (
  "id"           text PRIMARY KEY,
  "first_name"   text NOT NULL,
  "last_name"    text NOT NULL,
  "email"        text,
  "date_of_birth" text,
  "phone"        text,
  "parent_name"  text,
  "parent_phone" text,
  "parent_email" text,
  "address"      text,
  "notes"        text,
  "class_id"     text REFERENCES "classes"("id"),
  "enrolled_at"  timestamp NOT NULL DEFAULT now(),
  "updated_at"   timestamp NOT NULL DEFAULT now(),
  "deleted_at"   timestamp
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schedules" (
  "id"          text PRIMARY KEY,
  "class_id"    text NOT NULL REFERENCES "classes"("id"),
  "subject_id"  text NOT NULL REFERENCES "subjects"("id"),
  "teacher_id"  text NOT NULL REFERENCES "users"("id"),
  "day_of_week" integer NOT NULL,
  "start_time"  text NOT NULL,
  "end_time"    text NOT NULL,
  "updated_at"  timestamp NOT NULL DEFAULT now(),
  "deleted_at"  timestamp
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grades" (
  "id"         text PRIMARY KEY,
  "student_id" text NOT NULL REFERENCES "students"("id"),
  "subject_id" text NOT NULL REFERENCES "subjects"("id"),
  "class_id"   text NOT NULL REFERENCES "classes"("id"),
  "term"       text NOT NULL,
  "score"      integer NOT NULL,
  "teacher_id" text NOT NULL REFERENCES "users"("id"),
  "notes"      text,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendances" (
  "id"          text PRIMARY KEY,
  "student_id"  text NOT NULL REFERENCES "students"("id"),
  "schedule_id" text NOT NULL REFERENCES "schedules"("id"),
  "date"        text NOT NULL,
  "status"      text NOT NULL,
  "notes"       text,
  "teacher_id"  text NOT NULL REFERENCES "users"("id"),
  "updated_at"  timestamp NOT NULL DEFAULT now(),
  "deleted_at"  timestamp
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_plans" (
  "id"         text PRIMARY KEY,
  "class_id"   text NOT NULL REFERENCES "classes"("id"),
  "teacher_id" text NOT NULL REFERENCES "users"("id"),
  "week_start" text NOT NULL,
  "notes"      text,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_plan_entries" (
  "id"          text PRIMARY KEY,
  "plan_id"     text NOT NULL REFERENCES "weekly_plans"("id"),
  "schedule_id" text NOT NULL REFERENCES "schedules"("id"),
  "date"        text NOT NULL,
  "topic"       text,
  "objectives"  text,
  "activities"  text,
  "homework"    text,
  "updated_at"  timestamp NOT NULL DEFAULT now(),
  "deleted_at"  timestamp
);
