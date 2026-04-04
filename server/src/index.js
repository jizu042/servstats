
import express from 'express'
import cors from 'cors'
import crypto from 'node:crypto'
import { closeDb, connectRedis, hasDb, hasRedis, pool, redis } from './db.js'
import util from 'minecraft-server-util'

const app = express()
const PORT = Number(process.env.PORT || 8787)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const SESSION_COOKIE = 'msm_session'
const OAUTH_STATE_COOKIE = 'msm_oauth_state'
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'
const FRONTEND_URL = process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173'
const chatClients = new Set()

function redirectToFrontend(res, searchParams) {
  const base = FRONTEND_URL.replace(/\/$/, '')
  const q = new URLSearchParams(searchParams)
  return res.redirect(`${base}/?${q.toString()}`)
}
let redisSubscriber = null

app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN, credentials: true }))
app.use(express.json())

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'mc-monitor-api', db: hasDb, redis: hasRedis, now: new Date().toISOString() })
})

// ── /api/status ─────────────────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  const host   = String(req.query.host || '').trim()
  const port   = Number(req.query.port || 25565)
  const source = String(req.query.source || process.env.API_SOURCE_PREFERENCE || 'auto')

  if (!host) return res.status(400).json({ error: 'host is required' })

  try {
    let data = await getServerStatus({ host, port, source })

    // DB: compute real onlineSince from server_samples
    if (hasDb && pool) {
      await ensureServer({ host: data.host, port: data.port })
      const serverId = await getServerId(data.host, data.port)
      if (serverId && data.online) {
        // Walk backwards from latest sample to find start of current online streak
        const uptimeRes = await pool.query(
          `SELECT ts, online FROM server_samples
           WHERE server_id = $1
           ORDER BY ts DESC LIMIT 200`,
          [serverId]
        )
        let onlineSince = Date.now()
        for (const row of uptimeRes.rows) {
          if (!row.online) break
          onlineSince = new Date(row.ts).getTime()
        }
        data.onlineSince = onlineSince
      } else {
        data.onlineSince = null
      }
    }

    res.json(data)
  } catch (error) {
    console.warn(`[status] fetch failed for ${host}:${port} (${source}):`, error?.message || error)
    res.status(502).json({
      online: false, host, port,
      players: { online: 0, max: 0, list: [], listHidden: false },
      motd: { clean: 'Offline', raw: 'Offline' },
      ping: null, error: error?.message || 'status fetch failed'
    })
  }
})

// ── Chat ────────────────────────────────────────────────────────────────────
const chatMessages = [{ nick: 'System', text: 'Chat API ready', ts: Date.now() }]

app.get('/api/chat/messages', async (_req, res) => {
  if (hasDb && pool) {
    const q = await pool.query(
      'SELECT nick, text, EXTRACT(EPOCH FROM ts) * 1000 AS ts FROM chat_messages ORDER BY ts DESC LIMIT 100'
    )
    return res.json(q.rows.reverse().map((r) => ({ nick: r.nick, text: r.text, ts: Number(r.ts) })))
  }
  res.json(chatMessages.slice(-100))
})

app.get('/api/chat/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`)
  chatClients.add(res)
  const keepAlive = setInterval(() => res.write('event: ping\ndata: {}\n\n'), 25000)
  req.on('close', () => { clearInterval(keepAlive); chatClients.delete(res) })
})

app.post('/api/chat/messages', async (req, res) => {
  try {
    const me   = getUserFromRequest(req)
    const nick = String(me?.nick || req.body?.nick || 'Guest').slice(0, 24)
    const text = String(req.body?.text || '').trim().slice(0, 300)
    if (!text) return res.status(400).json({ error: 'text is required' })
    const msg = { nick, text, ts: Date.now() }
    if (hasDb && pool) {
      await pool.query(
        'INSERT INTO chat_messages(nick, text, ts) VALUES($1, $2, TO_TIMESTAMP($3 / 1000.0))',
        [nick, text, msg.ts]
      )
      if (redis?.isOpen) await redis.publish('chat:messages', JSON.stringify(msg))
      broadcastChat(msg)
      return res.status(201).json(msg)
    }
    chatMessages.push(msg)
    broadcastChat(msg)
    res.status(201).json(msg)
  } catch (e) {
    console.error('[chat] post message failed', e?.message || e)
    res.status(500).json({ error: 'failed to save message' })
  }
})

// ── Auth ────────────────────────────────────────────────────────────────────
app.get('/api/auth/ely/status', (_req, res) => {
  res.json({
    enabled: Boolean(process.env.ELY_OAUTH_CLIENT_ID && process.env.ELY_OAUTH_CLIENT_SECRET && process.env.ELY_OAUTH_REDIRECT_URI),
    provider: 'ely.by'
  })
})

app.get('/api/auth/ely/start', (req, res) => {
  const clientId   = process.env.ELY_OAUTH_CLIENT_ID
  const redirectUri = process.env.ELY_OAUTH_REDIRECT_URI
  const enabled    = Boolean(clientId && process.env.ELY_OAUTH_CLIENT_SECRET && redirectUri)
  if (!enabled) {
    if (String(req.query.redirect || '') === '1') return redirectToFrontend(res, { auth: 'error', reason: 'oauth_not_configured' })
    return res.status(501).json({ enabled: false, error: 'ely oauth is not configured' })
  }
  const state  = crypto.randomBytes(16).toString('hex')
  const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: 'account_info', state })
  setCookie(res, OAUTH_STATE_COOKIE, state, { maxAge: 10 * 60 })
  const url = `https://account.ely.by/oauth2/v1?${params.toString()}`
  if (String(req.query.redirect || '') === '1') return res.redirect(url)
  res.json({ enabled: true, url })
})

app.get('/api/auth/ely/callback', async (req, res) => {
  const code        = String(req.query.code || '')
  const state       = String(req.query.state || '')
  const clientId    = process.env.ELY_OAUTH_CLIENT_ID
  const clientSecret = process.env.ELY_OAUTH_CLIENT_SECRET
  const redirectUri = process.env.ELY_OAUTH_REDIRECT_URI
  if (!code) return redirectToFrontend(res, { auth: 'error', reason: 'missing_code' })
  if (!(clientId && clientSecret && redirectUri)) return redirectToFrontend(res, { auth: 'error', reason: 'oauth_not_configured' })
  const cookies = readCookies(req)
  if (!state || state !== cookies[OAUTH_STATE_COOKIE]) return redirectToFrontend(res, { auth: 'error', reason: 'invalid_state' })
  try {
    const tokenRes = await fetch('https://account.ely.by/api/oauth2/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(Number(process.env.POLL_TIMEOUT_MS || 8000))
    })
    if (!tokenRes.ok) {
      console.error('[oauth] token exchange failed', tokenRes.status)
      return redirectToFrontend(res, { auth: 'error', reason: 'token_exchange' })
    }
    const token   = await tokenRes.json()
    const userRes = await fetch('https://account.ely.by/api/account/v1/info', {
      headers: { Authorization: `Bearer ${token?.access_token}` },
      signal: AbortSignal.timeout(Number(process.env.POLL_TIMEOUT_MS || 8000))
    })
    if (!userRes.ok) return redirectToFrontend(res, { auth: 'error', reason: 'userinfo' })
    const profile = await userRes.json()
    const nick    = String(profile?.username || profile?.name || '').trim().slice(0, 24)
    if (!nick) return redirectToFrontend(res, { auth: 'error', reason: 'missing_username' })
    const session = makeSessionToken({ nick, iat: Date.now() })
    clearCookie(res, OAUTH_STATE_COOKIE)
    setCookie(res, SESSION_COOKIE, session, { maxAge: 60 * 60 * 24 * 7 })
    return redirectToFrontend(res, { auth: 'ok' })
  } catch (e) {
    console.error('[oauth] callback exception', e?.message || e)
    return redirectToFrontend(res, { auth: 'error', reason: 'callback_failed' })
  }
})

app.get('/api/me', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user) return res.json({ authenticated: false })
  res.json({
    authenticated: true,
    nick:   user.nick,
    avatar: `https://craft.ely.by/api/player/head/${encodeURIComponent(user.nick)}`
  })
})

app.post('/api/logout', (_req, res) => {
  clearCookie(res, SESSION_COOKIE)
  res.json({ ok: true })
})

// ── Stats history ────────────────────────────────────────────────────────────
app.get('/api/stats/history', async (req, res) => {
  const host  = String(req.query.host || '').trim()
  const port  = Number(req.query.port || 25565)
  const hours = Math.max(1, Math.min(24 * 7, Number(req.query.hours || 24)))
  if (!host) return res.status(400).json({ error: 'host is required' })
  if (!(hasDb && pool)) return res.json({ points: [], peak: 0, offlines: 0, avgUptimeSec: 0 })
  const serverId = await getServerId(host, port)
  if (!serverId) return res.json({ points: [], peak: 0, offlines: 0, avgUptimeSec: 0 })

  const q = await pool.query(
    `SELECT EXTRACT(EPOCH FROM ts) * 1000 AS t, players_online AS v, online
     FROM server_samples
     WHERE server_id = $1 AND ts >= NOW() - ($2::text || ' hours')::interval
     ORDER BY ts ASC`,
    [serverId, String(hours)]
  )

  const points    = q.rows.map((r) => ({ t: Number(r.t), v: Number(r.v) }))
  const peak      = points.reduce((acc, p) => Math.max(acc, p.v), 0)
  let offlines    = 0, onlineSince = null
  const uptimes   = []
  for (let i = 0; i < q.rows.length; i++) {
    const row      = q.rows[i]
    const isOnline = Boolean(row.online)
    const ts       = Number(row.t)
    const prev     = i > 0 ? Boolean(q.rows[i - 1].online) : null
    if (isOnline && !prev && onlineSince === null) onlineSince = ts
    if (!isOnline && prev) {
      offlines++
      if (onlineSince) uptimes.push(Math.floor((ts - onlineSince) / 1000))
      onlineSince = null
    }
  }
  const avgUptimeSec = uptimes.length ? Math.floor(uptimes.reduce((a, b) => a + b, 0) / uptimes.length) : 0
  res.json({ points, peak, offlines, avgUptimeSec })
})

// ── Player sessions ───────────────────────────────────────────────────────────
app.get('/api/stats/players', async (req, res) => {
  const host = String(req.query.host || '').trim()
  const port = Number(req.query.port || 25565)
  if (!host) return res.status(400).json({ error: 'host is required' })
  if (!(hasDb && pool)) return res.json([])
  const serverId = await getServerId(host, port)
  if (!serverId) return res.json([])

  const q = await pool.query(
    `SELECT nick,
            EXTRACT(EPOCH FROM started_at) * 1000 AS start,
            EXTRACT(EPOCH FROM ended_at)   * 1000 AS end
     FROM player_sessions
     WHERE server_id = $1
     ORDER BY started_at DESC
     LIMIT 500`,
    [serverId]
  )
  res.json(q.rows.map((r) => ({
    nick:  r.nick,
    start: Number(r.start),
    end:   r.end ? Number(r.end) : null
  })))
})

// Per-player session history
app.get('/api/stats/players/:nick/sessions', async (req, res) => {
  const host = String(req.query.host || '').trim()
  const port = Number(req.query.port || 25565)
  const nick = String(req.params.nick || '').trim()
  if (!host || !nick) return res.status(400).json({ error: 'host and nick are required' })
  if (!(hasDb && pool)) return res.json([])
  const serverId = await getServerId(host, port)
  if (!serverId) return res.json([])

  const q = await pool.query(
    `SELECT EXTRACT(EPOCH FROM started_at) * 1000 AS start,
            EXTRACT(EPOCH FROM ended_at)   * 1000 AS end
     FROM player_sessions
     WHERE server_id = $1 AND nick = $2
     ORDER BY started_at DESC
     LIMIT 100`,
    [serverId, nick]
  )
  res.json(q.rows.map((r) => ({ start: Number(r.start), end: r.end ? Number(r.end) : null })))
})

// ── Servers list ─────────────────────────────────────────────────────────────
app.get('/api/servers', async (_req, res) => {
  if (!(hasDb && pool)) return res.json([])
  const q = await pool.query('SELECT host, port, label, is_active FROM servers ORDER BY host, port')
  res.json(q.rows)
})

// ── Details (aggregated from multiple external APIs) ─────────────────────────
app.get('/api/details', async (req, res) => {
  const host = String(req.query.host || '').trim()
  const port = Number(req.query.port || 25565)
  if (!host) return res.status(400).json({ error: 'host is required' })

  const timeout = Number(process.env.POLL_TIMEOUT_MS || 8000)
  const result  = {}

  // Run all fetches in parallel
  const [directResult, ismcResult, mcstatusResult, mcsrvstatResult] = await Promise.allSettled([
    fetchDirect(host, port, timeout),
    fetchIsmcDetails(host, port, timeout),
    fetchMcstatusDetails(host, port, timeout),
    fetchMcsrvstatDetails(host, port, timeout)
  ])

  if (directResult.status === 'fulfilled')    result.direct    = directResult.value
  if (ismcResult.status === 'fulfilled')      result.ismcserver = ismcResult.value
  if (mcstatusResult.status === 'fulfilled')  result.mcstatus  = mcstatusResult.value
  if (mcsrvstatResult.status === 'fulfilled') result.mcsrvstat = mcsrvstatResult.value

  res.json(result)
})

// ── Bootstrap & shutdown ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => console.log(`mc-monitor-api listening on ${PORT}`))

bootstrap().catch((err) => console.error('bootstrap error', err))

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// ── Server status logic ──────────────────────────────────────────────────────
async function getServerStatus({ host, port, source }) {
  let directPing = null
  let directData = null

  // Always attempt direct TCP ping first for accurate latency
  try {
    const t0  = Date.now()
    const raw = await util.status(host, port, { timeout: 3000, enableSRV: true })
    directPing = raw.roundTripLatency ?? (Date.now() - t0)
    directData = {
      source:    'direct',
      pingSource: 'direct',
      online:    true,
      host,
      port,
      ping:      directPing,
      favicon:   raw.favicon || null,
      motd:      { raw: raw.motd?.raw || '', clean: raw.motd?.clean || '' },
      players:   buildPlayers({ online: raw.players?.online, max: raw.players?.max, sample: raw.players?.sample })
    }
  } catch {
    // direct failed — no direct TCP available
  }

  if (source === 'direct') {
    if (directData) return directData
    // Direct forced but failed — return offline
    return { source: 'direct', pingSource: 'direct', online: false, host, port, ping: null, players: { online: 0, max: 0, list: [], listHidden: false }, motd: { clean: 'Offline', raw: '' } }
  }

  if (source === 'ismcserver') {
    const ismc = normalizeIsmc(await fromIsmc(host, port), host, port)
    if (directPing !== null) { ismc.ping = directPing; ismc.pingSource = 'direct' }
    return ismc
  }

  if (source === 'mcstatus') {
    const mc = normalizeMcstatus(await fromMcstatus(host, port), host, port)
    if (directPing !== null) { mc.ping = directPing; mc.pingSource = 'direct' }
    return mc
  }

  // Auto: direct wins if available (best ping accuracy)
  if (directData) {
    // Enrich player list from ismc if direct list is hidden
    if (directData.players.listHidden) {
      try {
        const ismc = normalizeIsmc(await fromIsmc(host, port), host, port)
        if (ismc.players.list.length > 0) directData.players = ismc.players
      } catch { /* ignore */ }
    }
    return directData
  }

  // Fallback chain
  try {
    return normalizeIsmc(await fromIsmc(host, port), host, port)
  } catch {
    return normalizeMcstatus(await fromMcstatus(host, port), host, port)
  }
}

// ── External API fetchers ────────────────────────────────────────────────────
async function fromIsmc(host, port) {
  const token = process.env.ISMCSERVER_TOKEN
  if (!token) throw new Error('ISMCSERVER_TOKEN missing')
  const r = await fetch(
    `https://api.ismcserver.online/${encodeURIComponent(host)}:${encodeURIComponent(port)}`,
    { headers: { Authorization: token }, signal: AbortSignal.timeout(Number(process.env.POLL_TIMEOUT_MS || 8000)) }
  )
  if (!r.ok) throw new Error(`ismcserver ${r.status}`)
  return r.json()
}

async function fromMcstatus(host, port) {
  const r = await fetch(
    `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}:${encodeURIComponent(port)}`,
    { signal: AbortSignal.timeout(Number(process.env.POLL_TIMEOUT_MS || 8000)) }
  )
  if (!r.ok) throw new Error(`mcstatus ${r.status}`)
  return r.json()
}

async function fromMcsrvstat(host, port) {
  const r = await fetch(
    `https://api.mcsrvstat.us/3/${encodeURIComponent(host)}:${encodeURIComponent(port)}`,
    { signal: AbortSignal.timeout(Number(process.env.POLL_TIMEOUT_MS || 8000)) }
  )
  if (!r.ok) throw new Error(`mcsrvstat ${r.status}`)
  return r.json()
}

// ── Details fetchers (richer data for /api/details) ──────────────────────────
async function fetchDirect(host, port, timeout) {
  const raw = await util.status(host, port, { timeout: Math.min(timeout, 4000), enableSRV: true })
  return {
    source:  'direct',
    online:  true,
    host,    port,
    ping:    raw.roundTripLatency ?? null,
    version: raw.version?.name || null,
    favicon: raw.favicon || null,
    motd:    { raw: raw.motd?.raw || '', clean: raw.motd?.clean || '' },
    players: buildPlayers({ online: raw.players?.online, max: raw.players?.max, sample: raw.players?.sample })
  }
}

async function fetchIsmcDetails(host, port, timeout) {
  const token = process.env.ISMCSERVER_TOKEN
  if (!token) throw new Error('ISMCSERVER_TOKEN missing')
  const r = await fetch(
    `https://api.ismcserver.online/${encodeURIComponent(host)}:${encodeURIComponent(port)}`,
    { headers: { Authorization: token }, signal: AbortSignal.timeout(timeout) }
  )
  if (!r.ok) throw new Error(`ismcserver ${r.status}`)
  const raw = await r.json()
  return {
    source:      'ismcserver',
    online:      Boolean(raw?.online),
    host:        raw?.host || host,
    port:        raw?.port || port,
    ping:        raw?.ping ?? null,
    favicon:     raw?.favicon || null,
    motd:        { raw: raw?.motd?.raw || '', clean: raw?.motd?.clean || '' },
    players:     buildPlayers(raw?.players),
    version:     raw?.version || null,
    software:    raw?.software || null,
    tags:        Array.isArray(raw?.tags) ? raw.tags : [],
    description: raw?.description || null,
    votes:       raw?.votes ?? null,
    rating:      raw?.rating ?? null
  }
}

async function fetchMcstatusDetails(host, port, timeout) {
  const r = await fetch(
    `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}:${encodeURIComponent(port)}`,
    { signal: AbortSignal.timeout(timeout) }
  )
  if (!r.ok) throw new Error(`mcstatus ${r.status}`)
  const raw = await r.json()
  return {
    source:  'mcstatus',
    online:  Boolean(raw?.online),
    host:    raw?.host || host,
    port:    raw?.port || port,
    ping:    raw?.latency ?? raw?.ping ?? null,
    favicon: raw?.icon || null,
    motd:    { raw: raw?.motd?.raw || '', clean: raw?.motd?.clean || '' },
    players: buildPlayers(raw?.players),
    version: raw?.version?.name_clean || raw?.version?.name || null,
    software: raw?.software || null
  }
}

async function fetchMcsrvstatDetails(host, port, timeout) {
  const r = await fetch(
    `https://api.mcsrvstat.us/3/${encodeURIComponent(host)}:${encodeURIComponent(port)}`,
    { signal: AbortSignal.timeout(timeout) }
  )
  if (!r.ok) throw new Error(`mcsrvstat ${r.status}`)
  const raw = await r.json()
  const motdLines = Array.isArray(raw?.motd?.clean) ? raw.motd.clean.join('\n') : (raw?.motd?.clean || '')
  return {
    source:  'mcsrvstat',
    online:  Boolean(raw?.online),
    host:    raw?.hostname || host,
    port:    raw?.port || port,
    ping:    raw?.debug?.ping ?? null,
    favicon: raw?.icon || null,
    motd:    { raw: motdLines, clean: motdLines },
    players: {
      online: Number(raw?.players?.online || 0),
      max:    Number(raw?.players?.max || 0),
      list:   Array.isArray(raw?.players?.list) ? raw.players.list.map((p) => p.name || p).filter(Boolean) : [],
      listHidden: false
    },
    version:  raw?.version || null,
    software: raw?.software || null,
    plugins:  Array.isArray(raw?.plugins) ? raw.plugins.slice(0, 10).map((p) => p.name || p) : []
  }
}

// ── Player helpers ────────────────────────────────────────────────────────────
function mapPlayerEntry(p) {
  if (p == null) return null
  if (typeof p === 'string') { const t = p.trim(); return t ? t.slice(0, 32) : null }
  if (typeof p !== 'object') return null
  const name = p.name ?? p.username ?? p.displayName ?? p.profile?.name
  if (typeof name === 'string' && name.trim()) return name.trim().slice(0, 32)
  const id = p.id ?? p.uuid
  if (typeof id === 'string') {
    const hex = id.replace(/-/g, '')
    if (/^[0-9a-f]{8,32}$/i.test(hex)) return `…${hex.slice(-8)}`
  }
  return null
}

function buildPlayers(rawPlayers) {
  const rawList  = rawPlayers?.list ?? rawPlayers?.sample ?? []
  const list     = Array.isArray(rawList) ? rawList.map(mapPlayerEntry).filter(Boolean) : []
  const online   = Number(rawPlayers?.online || 0)
  const max      = Number(rawPlayers?.max || 0)
  const listHidden = online > 0 && list.length === 0
  return { online, max, list, listHidden }
}

function normalizeIsmc(raw, host, port) {
  return {
    source:     'ismcserver',
    pingSource: 'external',
    online:     Boolean(raw?.online),
    host:       raw?.host || host,
    port:       raw?.port || port,
    ping:       raw?.ping ?? null,
    favicon:    raw?.favicon || null,
    motd:       { raw: raw?.motd?.raw || '', clean: raw?.motd?.clean || raw?.motd?.raw || '' },
    players:    buildPlayers(raw?.players)
  }
}

function normalizeMcstatus(raw, host, port) {
  return {
    source:     'mcstatus',
    pingSource: 'external',
    online:     Boolean(raw?.online),
    host:       raw?.host || host,
    port:       raw?.port || port,
    ping:       raw?.latency ?? raw?.ping ?? null,
    favicon:    raw?.icon || null,
    motd:       { raw: raw?.motd?.raw || raw?.motd?.clean || '', clean: raw?.motd?.clean || raw?.motd?.raw || '' },
    players:    buildPlayers(raw?.players)
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function bootstrap() {
  if (hasRedis) {
    await connectRedis()
    redisSubscriber = redis.duplicate()
    await redisSubscriber.connect()
    await redisSubscriber.subscribe('chat:messages', (message) => {
      try { broadcastChat(JSON.parse(message)) } catch { /* ignore */ }
    })
  }
}

async function shutdown() {
  if (redisSubscriber?.isOpen) await redisSubscriber.quit()
  await closeDb()
  process.exit(0)
}

async function ensureServer({ host, port }) {
  await pool.query(
    `INSERT INTO servers(host, port) VALUES($1, $2)
     ON CONFLICT(host, port) DO UPDATE SET updated_at = NOW()`,
    [host, port]
  )
}

async function getServerId(host, port) {
  const q = await pool.query('SELECT id FROM servers WHERE host = $1 AND port = $2 LIMIT 1', [host, port])
  return q.rows[0]?.id || null
}

function broadcastChat(msg) {
  const payload = `event: message\ndata: ${JSON.stringify(msg)}\n\n`
  for (const client of chatClients) client.write(payload)
}

// ── Cookie helpers ────────────────────────────────────────────────────────────
function readCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';')
      .map((v) => v.trim()).filter(Boolean)
      .map((kv) => { const i = kv.indexOf('='); return i < 0 ? [kv, ''] : [kv.slice(0, i), decodeURIComponent(kv.slice(i + 1))] })
  )
}

function makeSessionToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!timingSafeEqual(sign(body), sig)) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!parsed?.nick) return null
    return parsed
  } catch { return null }
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url')
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

function setCookie(res, name, value, options = {}) {
  const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (process.env.NODE_ENV === 'production') attrs.push('Secure')
  if (options.maxAge) attrs.push(`Max-Age=${Math.floor(options.maxAge)}`)
  const existing = res.getHeader('Set-Cookie')
  const list = Array.isArray(existing) ? existing : existing ? [existing] : []
  list.push(attrs.join('; '))
  res.setHeader('Set-Cookie', list)
}

function clearCookie(res, name) { setCookie(res, name, '', { maxAge: 0 }) }

function getUserFromRequest(req) {
  return verifySessionToken(readCookies(req)[SESSION_COOKIE])
}
