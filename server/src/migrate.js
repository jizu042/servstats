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

  const sqlPath = path.join(__dirname, '..', 'sql', '001_init.sql')
  const sql = await fs.readFile(sqlPath, 'utf8')
  await pool.query(sql)
  console.log('migrations applied: 001_init.sql')
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('migration error', err)
    process.exit(1)
  })
