import 'dotenv/config'
import Fastify, { FastifyReply, FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { authRoutes }  from './routes/auth.js'
import { syncRoutes }  from './routes/sync.js'
import { adminRoutes } from './routes/admin.js'
import { runMigrations } from './migrate.js'

// Run DB migrations before starting the server
await runMigrations()

const app = Fastify({ logger: true })

// ── Plugins ────────────────────────────────────────────────────────────────────
await app.register(cors, {
  origin: ['http://localhost:5173'],
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'change-me-in-production',
})

// Decorator used on protected routes: onRequest: [app.authenticate]
app.decorate('authenticate', async function (req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
  }
})

// ── Routes ─────────────────────────────────────────────────────────────────────
app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

await app.register(authRoutes)
await app.register(syncRoutes)
await app.register(adminRoutes)

// ── Start ──────────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3000)
await app.listen({ port, host: '0.0.0.0' })
