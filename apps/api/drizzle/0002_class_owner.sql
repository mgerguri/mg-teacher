-- Migration 0002: per-teacher class ownership

--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "teacher_id" text REFERENCES "users"("id");
