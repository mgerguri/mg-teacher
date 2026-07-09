import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db.js'
import { pg } from '@mg-teacher/db'

const { users } = pg
type Role = 'admin' | 'teacher'

// ── Middleware: require admin role ─────────────────────────────────────────────

async function requireAdmin(req: any, reply: any) {
  await req.jwtVerify()
  if (req.user?.role !== 'admin') {
    return reply.status(403).send({ error: 'Admin access required' })
  }
}

export async function adminRoutes(app: FastifyInstance) {

  // ── List teachers ──────────────────────────────────────────────────────────

  app.get('/api/admin/teachers', {
    onRequest: [requireAdmin],
  }, async (_req, reply) => {
    const all = await db
      .select({
        id:        users.id,
        email:     users.email,
        firstName: users.firstName,
        lastName:  users.lastName,
        role:      users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
    return reply.send(all)
  })

  // ── Create teacher ──────────────────────────────────────────────────────────

  app.post<{
    Body: { email: string; password: string; firstName: string; lastName: string; role?: Role }
  }>('/api/admin/teachers', {
    onRequest: [requireAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email:     { type: 'string', format: 'email' },
          password:  { type: 'string', minLength: 6 },
          firstName: { type: 'string' },
          lastName:  { type: 'string' },
          role:      { type: 'string', enum: ['admin', 'teacher'] },
        },
      },
    },
  }, async (req, reply) => {
    const { email, password, firstName, lastName, role = 'teacher' } = req.body

    const [existing] = await db.select().from(users).where(eq(users.email, email))
    if (existing) {
      return reply.status(409).send({ error: 'Email already in use' })
    }

    const id           = randomUUID()
    const passwordHash = await bcrypt.hash(password, 12)
    const now          = new Date()

    await db.insert(users).values({ id, email, passwordHash, firstName, lastName, role, createdAt: now, updatedAt: now })

    return reply.status(201).send({ id, email, firstName, lastName, role })
  })

  // ── Update teacher ──────────────────────────────────────────────────────────

  app.put<{
    Params: { id: string }
    Body:   { firstName?: string; lastName?: string; role?: Role; password?: string }
  }>('/api/admin/teachers/:id', {
    onRequest: [requireAdmin],
  }, async (req, reply) => {
    const { id }                             = req.params
    const { firstName, lastName, role, password } = req.body

    const [existing] = await db.select().from(users).where(eq(users.id, id))
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const update: Record<string, unknown> = { updatedAt: new Date() }
    if (firstName) update.firstName = firstName
    if (lastName)  update.lastName  = lastName
    if (role)      update.role      = role
    if (password)  update.passwordHash = await bcrypt.hash(password, 12)

    await db.update(users).set(update).where(eq(users.id, id))

    return reply.send({ ok: true })
  })

  // ── Deactivate (soft-delete) teacher ────────────────────────────────────────
  // We don't actually delete — we could add a deletedAt column,
  // but for simplicity we just track it on the client side for now.
  // This endpoint resets the password to a random string making login impossible.

  app.delete<{ Params: { id: string } }>('/api/admin/teachers/:id', {
    onRequest: [requireAdmin],
  }, async (req, reply) => {
    const { id } = req.params
    // Prevent self-deactivation
    if ((req as any).user?.id === id) {
      return reply.status(400).send({ error: 'Cannot deactivate yourself' })
    }
    // Lock the account by setting a random password hash
    const locked = await bcrypt.hash(randomUUID(), 12)
    await db.update(users).set({ passwordHash: locked, updatedAt: new Date() }).where(eq(users.id, id))
    return reply.send({ ok: true })
  })
}
