import { Pool } from 'pg'
import { createClient } from 'redis'

const DATABASE_URL = process.env.DATABASE_URL
const REDIS_URL = process.env.REDIS_URL

export const hasDb = Boolean(DATABASE_URL)
export const hasRedis = Boolean(REDIS_URL)

export const pool = hasDb
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    })
  : null

export const redis = hasRedis
  ? createClient({ url: REDIS_URL })
  : null

export async function connectRedis() {
  if (!redis) return
  if (redis.isOpen) return
  redis.on('error', (err) => console.error('redis error', err.message))
  await redis.connect()
}

export async function closeDb() {
  if (redis?.isOpen) await redis.quit()
  if (pool) await pool.end()
}
