import { Pool } from 'pg'

const interval = Number(process.env.POLL_INTERVAL_MS || 10000)
const timeout = Number(process.env.POLL_TIMEOUT_MS || 8000)
const apiPreference = String(process.env.API_SOURCE_PREFERENCE || 'auto')
const retentionDays = Math.max(1, Number(process.env.STATS_RAW_RETENTION_DAYS || 30))
const servers = parseServers(process.env.MONITOR_SERVERS || '')
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    })
  : null

if (!pool) {
  console.error('DATABASE_URL is required for worker')
  process.exit(1)
}

if (servers.length === 0) {
  console.error('MONITOR_SERVERS is empty. Example: play.hypixel.net:25565,mc.example.com:25565')
  process.exit(1)
}

console.log('mc-monitor-collector started')
console.log('interval ms:', interval)
console.log('retention days:', retentionDays)
console.log('servers:', servers.map((s) => `${s.host}:${s.port}`).join(', '))

let lastRetentionRun = 0

await tick()
setInterval(tick, interval)

async function tick() {
  for (const s of servers) {
    try {
      const status = await getServerStatus({ host: s.host, port: s.port, source: apiPreference, timeout })
      const id = await ensureServer(s.host, s.port)
      await pool.query(
        `INSERT INTO server_samples(server_id, ts, online, players_online, players_max, ping_ms, source)
         VALUES($1, NOW(), $2, $3, $4, $5, $6)`,
        [id, status.online, status.players.online, status.players.max, status.ping, status.source]
      )
      console.log('saved sample', s.host, s.port, status.online, status.players.online)
    } catch (e) {
      console.error('collector tick error', s.host, s.port, e.message)
    }
  }

  const now = Date.now()
  if (now - lastRetentionRun > 60 * 60 * 1000) {
    await runRetention()
    lastRetentionRun = now
  }
}

async function runRetention() {
  try {
    await pool.query(
      `DELETE FROM server_samples
       WHERE ts < NOW() - ($1::text || ' days')::interval`,
      [String(retentionDays)]
    )
  } catch (e) {
    console.error('retention cleanup error', e.message)
  }
}

async function ensureServer(host, port) {
  const q = await pool.query(
    `INSERT INTO servers(host, port)
     VALUES($1, $2)
     ON CONFLICT(host, port)
     DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [host, port]
  )
  return q.rows[0].id
}

async function getServerStatus({ host, port, source, timeout }) {
  if (source === 'ismcserver') return normalizeIsmc(await fromIsmc(host, port, timeout), host, port)
  if (source === 'mcstatus') return normalizeMcstatus(await fromMcstatus(host, port, timeout), host, port)

  try {
    return normalizeIsmc(await fromIsmc(host, port, timeout), host, port)
  } catch {
    return normalizeMcstatus(await fromMcstatus(host, port, timeout), host, port)
  }
}

async function fromIsmc(host, port, timeoutMs) {
  const token = process.env.ISMCSERVER_TOKEN
  if (!token) throw new Error('ISMCSERVER_TOKEN missing')
  const url = `https://api.ismcserver.online/${encodeURIComponent(host)}:${encodeURIComponent(port)}`
  const r = await fetch(url, {
    headers: { Authorization: token },
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!r.ok) throw new Error(`ismcserver ${r.status}`)
  return r.json()
}

async function fromMcstatus(host, port, timeoutMs) {
  const url = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}:${encodeURIComponent(port)}`
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!r.ok) throw new Error(`mcstatus ${r.status}`)
  return r.json()
}

function normalizeIsmc(raw, host, port) {
  return {
    source: 'ismcserver',
    online: Boolean(raw?.online),
    host: raw?.host || host,
    port: raw?.port || port,
    ping: raw?.ping ?? null,
    players: {
      online: Number(raw?.players?.online || 0),
      max: Number(raw?.players?.max || 0)
    }
  }
}

function normalizeMcstatus(raw, host, port) {
  return {
    source: 'mcstatus',
    online: Boolean(raw?.online),
    host: raw?.host || host,
    port: raw?.port || port,
    ping: raw?.latency ?? raw?.ping ?? null,
    players: {
      online: Number(raw?.players?.online || 0),
      max: Number(raw?.players?.max || 0)
    }
  }
}

function parseServers(raw) {
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, portRaw] = entry.split(':')
      return { host, port: Number(portRaw || 25565) }
    })
    .filter((x) => x.host && !Number.isNaN(x.port))
}
