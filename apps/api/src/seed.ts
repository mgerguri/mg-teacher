// Manual convenience wrapper around ensureDefaultAdmin() — the server now
// seeds this account automatically on every boot (see index.ts), so this
// script is only needed to create it on demand without starting the server.
// Usage: pnpm db:seed

import 'dotenv/config'
import { ensureDefaultAdmin, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } from './ensure-default-admin.js'

await ensureDefaultAdmin()

console.log('✓ Seed complete')
console.log(`  Email:    ${DEFAULT_ADMIN_EMAIL}`)
console.log(`  Password: ${DEFAULT_ADMIN_PASSWORD}`)
console.log(`  Role:     admin`)

process.exit(0)
