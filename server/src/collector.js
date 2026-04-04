import util from 'minecraft-server-util'

const interval      = Number(process.env.POLL_INTERVAL_MS || 14 * 60 * 1000) // Default: 14 mins
const timeout       = Number(process.env.POLL_TIMEOUT_MS  || 8000)
const apiPreference = String(process.env.API_SOURCE_PREFERENCE || 'auto')
const retentionDays = Math.max(1, Number(process.env.STATS_RAW_RETENTION_DAYS || 30))

// In-memory: previous player list per server (for session diff)
const prevPlayers = {} // key: `host:port`, value: Set<nick>
let lastRetentionRun = 0

/** Start the background collector loop if MONITOR_SERVERS is provided or dynamically sync from DB */
export function startCollector(pool) {
  const envServers = parseServers(process.env.MONITOR_SERVERS || '')

  console.log(`[collector] starting. Interval: ${Math.round(interval / 1000 / 60)}m.`)

  // Run first tick after 5s to avoid interfering with server startup
  setTimeout(async () => {
    await doTick(pool, envServers)
    setInterval(() => doTick(pool, envServers), interval)
  }, 5000)
}

async function doTick(pool, envServers) {
  let servers = envServers
  if (servers.length === 0) {
    try {
      const q = await pool.query('SELECT host, port FROM servers ORDER BY updated_at DESC LIMIT 10')
      servers = q.rows.map(r => ({ host: r.host, port: r.port }))
      if (servers.length === 0) servers = [{ host: 'play.hypixel.net', port: 25565 }]
    } catch {
      servers = [{ host: 'play.hypixel.net', port: 25565 }]
    }
  }
  await tick(pool, servers)
}

async function tick(pool, servers) {
  for (const s of servers) {
    const key = `${s.host}:${s.port}`
    try {
      const status = await getServerStatus({ host: s.host, port: s.port, source: apiPreference, timeout })
      const id     = await ensureServer(pool, s.host, s.port)

      // Save server sample
      await pool.query(
        `INSERT INTO server_samples(server_id, ts, online, players_online, players_max, ping_ms, source)
         VALUES($1, NOW(), $2, $3, $4, $5, $6)`,
        [id, status.online, status.players.online, status.players.max, status.ping, status.source]
      )

      // Update player sessions
      if (status.online) {
        const currentNicks = new Set(status.players.list || [])
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
            console.log(`[collector] session opened: ${nick} on ${key}`)
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
            console.log(`[collector] session closed: ${nick} on ${key}`)
          }
        }

        prevPlayers[key] = currentNicks
      } else {
        // Server went offline — close all open sessions
        if (prevPlayers[key] && prevPlayers[key].size > 0) {
          await pool.query(
            `UPDATE player_sessions
             SET ended_at = NOW()
             WHERE server_id = $1 AND ended_at IS NULL`,
            [id]
          )
          console.log(`[collector] server offline — closed open sessions for ${key}`)
        }
        prevPlayers[key] = new Set()
      }
    } catch (e) {
      console.warn(`[collector] fetch failed for ${key}:`, e.message)
    }
  }

  // Periodic cleanup
  const now = Date.now()
  if (now - lastRetentionRun > 60 * 60 * 1000) {
    await runRetention(pool)
    lastRetentionRun = now
  }
}

async function runRetention(pool) {
  try {
    await pool.query(
      `DELETE FROM server_samples WHERE ts < NOW() - ($1::text || ' days')::interval`,
      [String(retentionDays)]
    )
    console.log('[collector] data retention cleanup done')
  } catch (e) {
    console.error('[collector] retention error', e.message)
  }
}

async function ensureServer(pool, host, port) {
  const q = await pool.query(
    `INSERT INTO servers(host, port) VALUES($1, $2)
     ON CONFLICT(host, port) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [host, port]
  )
  return q.rows[0].id
}

async function getServerStatus({ host, port, source, timeout: ms }) {
  // Try direct TCP ping first for reliable player list
  try {
    const raw = await util.status(host, port, { timeout: Math.min(ms, 4000), enableSRV: true })
    return {
      source:  'direct',
      online:  true,
      host,    port,
      ping:    raw.roundTripLatency ?? null,
      players: buildPlayers({ online: raw.players?.online, max: raw.players?.max, sample: raw.players?.sample })
    }
  } catch { /* direct failed, fall through to external APIs */ }

  if (source === 'ismcserver') return normalizeIsmc(await fromIsmc(host, port, ms), host, port)
  if (source === 'mcstatus')   return normalizeMcstatus(await fromMcstatus(host, port, ms), host, port)

  // Auto fallback chain
  try {
    return normalizeIsmc(await fromIsmc(host, port, ms), host, port)
  } catch {
    return normalizeMcstatus(await fromMcstatus(host, port, ms), host, port)
  }
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

function parseServers(raw) {
  return raw.split(',').map((x) => x.trim()).filter(Boolean).map((entry) => {
    const [host, portRaw] = entry.split(':')
    return { host, port: Number(portRaw || 25565) }
  }).filter((x) => x.host && !Number.isNaN(x.port))
}
