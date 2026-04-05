import { Pool } from 'pg'
import util from 'minecraft-server-util'

const interval      = Number(process.env.POLL_INTERVAL_MS || 5 * 60 * 1000) // 5 minutes (improved from 14)
const timeout       = Number(process.env.POLL_TIMEOUT_MS  || 8000)
const apiPreference = String(process.env.API_SOURCE_PREFERENCE || 'auto')
const retentionDays = Math.max(1, Number(process.env.STATS_RAW_RETENTION_DAYS || 30))
const servers       = parseServers(process.env.MONITOR_SERVERS || '')

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
  console.error('MONITOR_SERVERS is empty. Example: play.hypixel.net:25565')
  process.exit(1)
}

console.log('mc-monitor-collector started')
console.log('interval ms:', interval)
console.log('retention days:', retentionDays)
console.log('servers:', servers.map((s) => `${s.host}:${s.port}`).join(', '))

// In-memory: previous player list per server (for session diff)
const prevPlayers = {} // key: `host:port`, value: Set<nick>

let lastRetentionRun = 0

await tick()
setInterval(tick, interval)

async function tick() {
  for (const s of servers) {
    const key = `${s.host}:${s.port}`
    try {
      const status = await getServerStatus({ host: s.host, port: s.port, source: apiPreference, timeout })
      const id     = await ensureServer(s.host, s.port)

      // Save server sample
      await pool.query(
        `INSERT INTO server_samples(server_id, ts, online, players_online, players_max, ping_ms, source)
         VALUES($1, NOW(), $2, $3, $4, $5, $6)`,
        [id, status.online, status.players.online, status.players.max, status.ping, status.source]
      )
      console.log('[collector] sample saved', s.host, s.port, status.online, status.players.online)

      // Update player sessions
      if (status.online) {
        const currentNicks = new Set((status.players.list || []).filter(n => n && n.trim()))
        const previous     = prevPlayers[key] || new Set()

        // Players who just joined (in current, not in previous)
        for (const nick of currentNicks) {
          if (!previous.has(nick)) {
            // Open a new session — close any dangling open session first
            await pool.query(
              `UPDATE player_sessions
               SET ended_at = NOW()
               WHERE server_id = $1 AND nick = $2 AND ended_at IS NULL`,
              [id, nick]
            )
            await pool.query(
              `INSERT INTO player_sessions(server_id, nick, started_at)
               VALUES($1, $2, NOW())`,
              [id, nick]
            )
            console.log(`[collector] ✓ session opened: ${nick} on ${key}`)
          }
        }

        // Players who just left (in previous, not in current)
        for (const nick of previous) {
          if (!currentNicks.has(nick)) {
            await pool.query(
              `UPDATE player_sessions
               SET ended_at = NOW()
               WHERE server_id = $1 AND nick = $2 AND ended_at IS NULL`,
              [id, nick]
            )
            console.log(`[collector] ✓ session closed: ${nick} on ${key}`)
          }
        }

        prevPlayers[key] = currentNicks

        if (currentNicks.size > 0) {
          console.log(`[collector] ${key} tracking ${currentNicks.size} players: ${Array.from(currentNicks).join(', ')}`)
        }
      } else {
        // Server went offline — close all open sessions
        if (prevPlayers[key] && prevPlayers[key].size > 0) {
          await pool.query(
            `UPDATE player_sessions
             SET ended_at = NOW()
             WHERE server_id = $1 AND ended_at IS NULL`,
            [id]
          )
          console.log(`[collector] server offline — closed all open sessions for ${key}`)
        }
        prevPlayers[key] = new Set()
      }
    } catch (e) {
      console.error('[collector] tick error', s.host, s.port, e.message)
    }
  }

  // Periodic cleanup
  const now = Date.now()
  if (now - lastRetentionRun > 60 * 60 * 1000) {
    await runRetention()
    lastRetentionRun = now
  }
}

async function runRetention() {
  try {
    await pool.query(
      `DELETE FROM server_samples WHERE ts < NOW() - ($1::text || ' days')::interval`,
      [String(retentionDays)]
    )
    console.log('[collector] retention cleanup done')
  } catch (e) {
    console.error('[collector] retention error', e.message)
  }
}

async function ensureServer(host, port) {
  const q = await pool.query(
    `INSERT INTO servers(host, port) VALUES($1, $2)
     ON CONFLICT(host, port) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [host, port]
  )
  return q.rows[0].id
}

// ── Status fetchers ───────────────────────────────────────────────────────────
async function getServerStatus({ host, port, source, timeout: ms }) {
  // Always try direct first for player list accuracy
  try {
    const raw = await util.status(host, port, { timeout: Math.min(ms, 4000), enableSRV: true })
    return {
      source:  'direct',
      online:  true,
      host,    port,
      ping:    raw.roundTripLatency ?? null,
      players: buildPlayers({ online: raw.players?.online, max: raw.players?.max, sample: raw.players?.sample })
    }
  } catch {
    // direct failed, fall through
  }

  if (source === 'ismcserver') return normalizeIsmc(await fromIsmc(host, port, ms), host, port)
  if (source === 'mcstatus')   return normalizeMcstatus(await fromMcstatus(host, port, ms), host, port)
  if (source === 'mcsrvstat')  return normalizeMcsrvstat(await fromMcsrvstat(host, port, ms), host, port)

  // Auto fallback - try all sources
  const sources = [
    { fn: () => fromIsmc(host, port, ms), normalize: (d) => normalizeIsmc(d, host, port) },
    { fn: () => fromMcstatus(host, port, ms), normalize: (d) => normalizeMcstatus(d, host, port) },
    { fn: () => fromMcsrvstat(host, port, ms), normalize: (d) => normalizeMcsrvstat(d, host, port) }
  ]

  for (const source of sources) {
    try {
      const data = await source.fn()
      return source.normalize(data)
    } catch (err) {
      continue
    }
  }

  throw new Error('All API sources failed')
}

async function fromIsmc(host, port, timeoutMs) {
  const token = process.env.ISMCSERVER_TOKEN
  if (!token) throw new Error('ISMCSERVER_TOKEN missing')
  const r = await fetch(
    `https://api.ismcserver.online/${encodeURIComponent(host)}:${encodeURIComponent(port)}`,
    { headers: { Authorization: token }, signal: AbortSignal.timeout(timeoutMs) }
  )
  if (!r.ok) throw new Error(`ismcserver ${r.status}`)
  return r.json()
}

async function fromMcstatus(host, port, timeoutMs) {
  const r = await fetch(
    `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}:${encodeURIComponent(port)}`,
    { signal: AbortSignal.timeout(timeoutMs) }
  )
  if (!r.ok) throw new Error(`mcstatus ${r.status}`)
  return r.json()
}

async function fromMcsrvstat(host, port, timeoutMs) {
  const r = await fetch(
    `https://api.mcsrvstat.us/3/${encodeURIComponent(host)}:${encodeURIComponent(port)}`,
    { signal: AbortSignal.timeout(timeoutMs) }
  )
  if (!r.ok) throw new Error(`mcsrvstat ${r.status}`)
  return r.json()
}

function mapPlayerEntry(p) {
  if (p == null) return null
  if (typeof p === 'string') { const t = p.trim(); return t ? t.slice(0, 32) : null }
  if (typeof p !== 'object') return null
  const name = p.name ?? p.username ?? p.displayName ?? p.profile?.name
  if (typeof name === 'string' && name.trim()) return name.trim().slice(0, 32)
  return null
}

function buildPlayers(rawPlayers) {
  const rawList = rawPlayers?.list ?? rawPlayers?.sample ?? []
  const list    = Array.isArray(rawList) ? rawList.map(mapPlayerEntry).filter(Boolean) : []
  return {
    online: Number(rawPlayers?.online || 0),
    max:    Number(rawPlayers?.max || 0),
    list
  }
}

function normalizeIsmc(raw, host, port) {
  return {
    source:  'ismcserver',
    online:  Boolean(raw?.online),
    host:    raw?.host || host,
    port:    raw?.port || port,
    ping:    raw?.ping ?? null,
    players: buildPlayers({ online: raw?.players?.online, max: raw?.players?.max, list: raw?.players?.list })
  }
}

function normalizeMcstatus(raw, host, port) {
  return {
    source:  'mcstatus',
    online:  Boolean(raw?.online),
    host:    raw?.host || host,
    port:    raw?.port || port,
    ping:    raw?.latency ?? raw?.ping ?? null,
    players: buildPlayers({ online: raw?.players?.online, max: raw?.players?.max })
  }
}

function normalizeMcsrvstat(raw, host, port) {
  return {
    source:  'mcsrvstat',
    online:  Boolean(raw?.online),
    host:    raw?.hostname || host,
    port:    raw?.port || port,
    ping:    null,
    players: buildPlayers({ online: raw?.players?.online, max: raw?.players?.max, list: raw?.players?.list })
  }
}

function parseServers(raw) {
  return raw.split(',').map((x) => x.trim()).filter(Boolean).map((entry) => {
    const [host, portRaw] = entry.split(':')
    return { host, port: Number(portRaw || 25565) }
  }).filter((x) => x.host && !Number.isNaN(x.port))
}
