-- Migration 0003: bring the server schema back in line with the client.
--
-- The web app moved attendance from per-period (schedule_id) to per-day
-- (class_id) tracking in local-db.ts v7, but the server table was never
-- updated: it still required a NOT NULL schedule_id that the client stopped
-- sending. Every /api/sync/push carrying an attendance row therefore failed,
-- and because push runs before pull, that one failure blocked the whole sync
-- for that user. Same story for assessments.grade, which the client writes
-- and the server had nowhere to store.

--> statement-breakpoint
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "class_id" text REFERENCES "classes"("id");

--> statement-breakpoint
-- Backfill from the period each old row was recorded against.
UPDATE "attendances" a
   SET "class_id" = s."class_id"
  FROM "schedules" s
 WHERE a."schedule_id" = s."id"
   AND a."class_id" IS NULL;

--> statement-breakpoint
-- Kept as a nullable column rather than dropped so existing rows stay
-- readable, but new per-day rows legitimately have no period to point at.
ALTER TABLE "attendances" ALTER COLUMN "schedule_id" DROP NOT NULL;

--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "grade" integer;
