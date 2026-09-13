// Type declarations for what we add to Fastify at runtime.
//
// `app.decorate('authenticate', …)` in index.ts is invisible to TypeScript
// on its own, so every `onRequest: [app.authenticate]` was a compile error
// and `pnpm build:api` failed. Declaring it here is what makes the
// decorator (and the shape of a verified JWT) part of the public types.

import '@fastify/jwt'
import { FastifyReply, FastifyRequest } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    // What we sign in auth.ts — `sub` is the user id. Note it is `sub`, not
    // `id`: reading `req.user.id` silently yields undefined.
    payload: { sub: string; email: string; role: 'admin' | 'teacher' }
    user:    { sub: string; email: string; role: 'admin' | 'teacher' }
  }
}
