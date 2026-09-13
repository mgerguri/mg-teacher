import 'dotenv/config'
import Fastify, { FastifyReply, FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { authRoutes }  from './routes/auth.js'
import { syncRoutes }  from './routes/sync.js'
import { adminRoutes } from './routes/admin.js'
import { runMigrations } from './migrate.js'
import { ensureDefaultAdmin } from './ensure-default-admin.js'

const isProduction = process.env.NODE_ENV === 'production'

// Anyone who knows the signing secret can mint a token for any user with any
// role, so a hardcoded fallback is the same as no authentication at all.
// Refuse to boot a production server without a real one rather than silently
// running on a value that is published in this repo.
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret && isProduction) {
  throw new Error('JWT_SECRET env var is required when NODE_ENV=production')
}
if (!jwtSecret) {
  console.warn('[startup] JWT_SECRET is not set — using an insecure development-only secret.')
}

// Run DB migrations before starting the server
await runMigrations()
await ensureDefaultAdmin()

const app = Fastify({ logger: true })

// ── Plugins ────────────────────────────────────────────────────────────────────
// Hardcoding the dev server origin means a deployed frontend on any other
// origin is blocked by the browser, so this is configurable. CORS_ORIGIN takes
// a comma-separated list.
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

await app.register(cors, {
  origin: corsOrigins,
})

await app.register(jwt, {
  secret: jwtSecret ?? 'insecure-development-secret',
})

// Decorator used on protected routes: onRequest: [app.authenticate]
app.decorate('authenticate', async function (req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
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
