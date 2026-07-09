import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { pg as schema } from '@mg-teacher/db'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL env var is required')
}

const client = postgres(process.env.DATABASE_URL)
export const db = drizzle(client, { schema })
