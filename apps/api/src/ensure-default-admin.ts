// Guarantees a working admin login exists after migrations run, so there's
// no manual seeding step between provisioning a fresh database and signing
// in for the first time. Called on every server boot (see index.ts) — the
// unique constraint on `email` makes this a no-op once any account exists
// with this address, so it's safe to run repeatedly.

import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { db } from './db.js'
import { pg } from '@mg-teacher/db'

const { users } = pg

export const DEFAULT_ADMIN_EMAIL = 'teacher@school.com'
export const DEFAULT_ADMIN_PASSWORD = 'password123'

export async function ensureDefaultAdmin(): Promise<void> {
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
}
