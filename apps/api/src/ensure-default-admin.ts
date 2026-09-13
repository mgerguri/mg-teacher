// Guarantees a working admin login exists after migrations run, so there's
// no manual seeding step between provisioning a fresh database and signing
// in for the first time.
//
// These credentials are published in this repository, so an instance still
// carrying them is an instance anyone can sign into as an admin — and an
// admin reads and writes every teacher's data through /api/sync. Two things
// keep that from being the default:
//
//  1. Seeding only happens into a genuinely empty `users` table. Once a real
//     account exists, this is a no-op. Previously it re-inserted on every
//     boot keyed on the email, so deleting the default admin brought it
//     straight back on the next restart.
//  2. In production it has to be asked for explicitly, via
//     SEED_DEFAULT_ADMIN=true, and the password can be overridden with
//     DEFAULT_ADMIN_PASSWORD.

import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { sql } from 'drizzle-orm'
import { db } from './db.js'
import { pg } from '@mg-teacher/db'

const { users } = pg

export const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL ?? 'teacher@school.com'
export const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD ?? 'password123'

export function defaultAdminEnabled(): boolean {
  if (process.env.SEED_DEFAULT_ADMIN === 'false') return false
  if (process.env.SEED_DEFAULT_ADMIN === 'true') return true
  return process.env.NODE_ENV !== 'production'
}

export async function ensureDefaultAdmin(): Promise<void> {
  if (!defaultAdminEnabled()) return

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
  if (count > 0) return

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12)
  await db
    .insert(users)
    .values({
      id: randomUUID(),
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'Account',
    })
    .onConflictDoNothing({ target: users.email })

  console.warn(
    `[startup] Seeded default admin ${DEFAULT_ADMIN_EMAIL}. Change this password before exposing the server.`
  )
}
