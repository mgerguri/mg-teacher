import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db.js'
import { pg } from '@mg-teacher/db'

const { users } = pg
type Role = 'admin' | 'teacher'

// Email is the login identifier and is UNIQUE in the database, so it has to
// be compared the same way everywhere. Without this, registering
// "Teacher@School.com" and then signing in as "teacher@school.com" fails,
// and the same person can end up with two accounts.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function authRoutes(app: FastifyInstance) {
  // ── Register ────────────────────────────────────────────────────────────────
  // This endpoint is unauthenticated, so whatever it is willing to grant is
  // available to anyone who can reach the server. It used to accept a `role`
  // from the request body, which meant `{"role":"admin"}` handed the caller
  // an admin account — and admins read and write every teacher's data
  // through /api/sync. The role is now fixed server-side; promoting someone
  // to admin is an admin-only action via /api/admin/teachers.
  app.post<{
    Body: { email: string; password: string; firstName: string; lastName: string }
  }>('/api/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        additionalProperties: false,
        properties: {
          email:     { type: 'string', format: 'email' },
          password:  { type: 'string', minLength: 8 },
          firstName: { type: 'string', minLength: 1 },
          lastName:  { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req, reply) => {
    const { password, firstName, lastName } = req.body
    const email: string = normalizeEmail(req.body.email)
    const role: Role = 'teacher'

    const [existing] = await db.select().from(users).where(eq(users.email, email))
    if (existing) {
      return reply.status(409).send({ error: 'Email already in use' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const id = randomUUID()

    await db.insert(users).values({ id, email, passwordHash, firstName, lastName, role })

    const token = app.jwt.sign({ sub: id, email, role }, { expiresIn: '7d' })
    return reply.status(201).send({ token, user: { id, email, firstName, lastName, role } })
  })

  // ── Login ───────────────────────────────────────────────────────────────────
  app.post<{
    Body: { email: string; password: string }
  }>('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { password } = req.body
    const email = normalizeEmail(req.body.email)

    const [user] = await db.select().from(users).where(eq(users.email, email))
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role }, { expiresIn: '7d' })
    return reply.send({
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    })
  })

  // ── Me ──────────────────────────────────────────────────────────────────────
  app.get('/api/auth/me', { onRequest: [app.authenticate] }, async (req, reply) => {
    const payload = req.user as { sub: string; email: string; role: Role }
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub))
    if (!user) return reply.status(404).send({ error: 'User not found' })

    return reply.send({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    })
  })

}
