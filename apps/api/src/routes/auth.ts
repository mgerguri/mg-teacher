import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db.js'
import { pg } from '@mg-teacher/db'

const { users } = pg
type Role = 'admin' | 'teacher'

export async function authRoutes(app: FastifyInstance) {
  // ── Register ────────────────────────────────────────────────────────────────
  app.post<{
    Body: { email: string; password: string; firstName: string; lastName: string; role?: Role }
  }>('/api/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email:     { type: 'string', format: 'email' },
          password:  { type: 'string', minLength: 8 },
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
    const { email, password } = req.body

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
