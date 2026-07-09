import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function runMigrations() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  // Separate short-lived connection just for migrations
  const migrationClient = postgres(url, { max: 1 })
  const db = drizzle(migrationClient)

  console.log('[migrate] Running migrations…')
  await migrate(db, { migrationsFolder: join(__dirname, '../drizzle') })
  console.log('[migrate] Done.')

  await migrationClient.end()
}
