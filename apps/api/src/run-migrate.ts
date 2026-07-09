// Standalone entry point: `pnpm db:migrate`
// Run this in CI/CD after deploy to apply pending migrations.
import 'dotenv/config'
import { runMigrations } from './migrate.js'

await runMigrations()
process.exit(0)
