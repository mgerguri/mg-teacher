// Seed script: creates a default admin account for testing.
// Usage: pnpm db:seed
// Safe to run multiple times — uses INSERT ... ON CONFLICT DO NOTHING.

import 'dotenv/config'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(url, { max: 1 })

const email    = 'teacher@school.com'
const password = 'password123'
const hash     = await bcrypt.hash(password, 12)

await sql`
  INSERT INTO users (id, email, password_hash, role, first_name, last_name)
  VALUES (
    ${randomUUID()},
    ${email},
    ${hash},
    'admin',
    'Test',
    'Teacher'
  )
  ON CONFLICT (email) DO NOTHING
`

console.log('✓ Seed complete')
console.log(`  Email:    ${email}`)
console.log(`  Password: ${password}`)
console.log(`  Role:     admin`)

await sql.end()
process.exit(0)
