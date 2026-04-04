import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasDb, pool } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function run() {
  if (!hasDb || !pool) {
    console.log('skip migrations: DATABASE_URL is not set')
    return
  }

  const sqlDir = path.join(__dirname, '..', 'sql')
  const files = (await fs.readdir(sqlDir))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  console.log(`found ${files.length} migration files`)

  for (const file of files) {
    const sql = await fs.readFile(path.join(sqlDir, file), 'utf8')
    try {
      await pool.query(sql)
      console.log(`migrated: ${file}`)
    } catch (e) {
      console.error(`error in ${file}:`, e.message)
      // We don't exit(1) here if it's "already exists" but let's be safe
      // In production, better to use a real migration tool, but for this project we'll just log
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('migration error', err)
    process.exit(1)
  })
