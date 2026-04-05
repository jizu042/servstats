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
      // Ignore "already exists" errors (42P07 = duplicate table, 42701 = duplicate column, 42710 = duplicate object)
      if (['42P07', '42701', '42710', '42P16'].includes(e.code)) {
        console.log(`skipped ${file}: already exists`)
      } else if (e.code === '42703') {
        // Column does not exist - this might be okay if we're adding it
        console.log(`warning in ${file}: ${e.message}`)
      } else {
        console.error(`error in ${file}:`, e.message)
      }
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('migration error', err)
    process.exit(1)
  })
