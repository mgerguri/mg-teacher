-- Migration 0001: assessments, conduct_notes, contact_logs

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessments" (
  "id"         text PRIMARY KEY,
  "student_id" text NOT NULL REFERENCES "students"("id"),
  "subject_id" text NOT NULL REFERENCES "subjects"("id"),
  "class_id"   text NOT NULL REFERENCES "classes"("id"),
  "teacher_id" text NOT NULL REFERENCES "users"("id"),
  "title"      text NOT NULL,
  "type"       text NOT NULL,
  "score"      integer NOT NULL,
  "max_score"  integer NOT NULL,
  "date"       text NOT NULL,
  "notes"      text,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conduct_notes" (
  "id"         text PRIMARY KEY,
  "student_id" text NOT NULL REFERENCES "students"("id"),
  "teacher_id" text NOT NULL REFERENCES "users"("id"),
  "date"       text NOT NULL,
  "category"   text NOT NULL,
  "note"       text NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_logs" (
  "id"         text PRIMARY KEY,
  "student_id" text NOT NULL REFERENCES "students"("id"),
  "teacher_id" text NOT NULL REFERENCES "users"("id"),
  "date"       text NOT NULL,
  "method"     text NOT NULL,
  "topic"      text NOT NULL,
  "outcome"    text,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);
