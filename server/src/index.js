
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

app.get('/api/status', async (req, res) => {
  const host = String(req.query.host || '').trim()
  const port = Number(req.query.port || 25565)
  const source = String(req.query.source || process.env.API_SOURCE_PREFERENCE || 'auto')

  if (!host) return res.status(400).json({ error: 'host is required' })

  try {
    let data = await getServerStatus({ host, port, source })
    if (hasDb && pool) {
      const serverId = await getServerId(data.host, data.port)
      if (serverId) {
        const uptimeRes = await pool.query(`
          SELECT ts, online FROM server_samples 
          WHERE server_id = $1 
          ORDER BY ts DESC LIMIT 100
        `, [serverId])
        
        let onlineSince = null;
        if (data.online) {
            onlineSince = Date.now();
            for (const row of uptimeRes.rows) {
                if (!row.online) break;
                onlineSince = new Date(row.ts).getTime();
            }
        }
        data.onlineSince = onlineSince;
      }
      await ensureServer({ host: data.host, port: data.port })
    }
    res.json(data)
  } catch (error) {
    console.warn(`[status] fetch failed for ${host}:${port} (${source}):`, error?.message || error)
    res.status(502).json({
      online: false,
      host,
      port,
      players: { online: 0, max: 0, list: [], listHidden: false },
      motd: { clean: 'Offline', raw: 'Offline' },
      ping: null,
      error: error?.message || 'status fetch failed'
    })
  }
})

const chatMessages = [{ nick: 'System', text: 'Chat API ready', ts: Date.now() }]

app.get('/api/chat/messages', async (_req, res) => {
  if (hasDb && pool) {
    const q = await pool.query('SELECT nick, text, EXTRACT(EPOCH FROM ts) * 1000 AS ts FROM chat_messages ORDER BY ts DESC LIMIT 100')
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

  const keepAlive = setInterval(() => {
    res.write('event: ping\ndata: {}\n\n')
  }, 25000)

  req.on('close', () => {
    clearInterval(keepAlive)
    chatClients.delete(res)
  })
})

app.post('/api/chat/messages', async (req, res) => {
  try {
    const me = getUserFromRequest(req)
    const nick = String(me?.nick || req.body?.nick || 'Guest').slice(0, 24)
    const text = String(req.body?.text || '').trim().slice(0, 300)
    if (!text) return res.status(400).json({ error: 'text is required' })
    const msg = { nick, text, ts: Date.now() }

    if (hasDb && pool) {
      await pool.query('INSERT INTO chat_messages(nick, text, ts) VALUES($1, $2, TO_TIMESTAMP($3 / 1000.0))', [nick, text, msg.ts])
      if (redis?.isOpen) {
        await redis.publish('chat:messages', JSON.stringify(msg))
      }
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

app.get('/api/auth/ely/status', (_req, res) => {
  res.json({
    enabled: Boolean(process.env.ELY_OAUTH_CLIENT_ID && process.env.ELY_OAUTH_CLIENT_SECRET && process.env.ELY_OAUTH_REDIRECT_URI),
    provider: 'ely.by'
  })
})

app.get('/api/auth/ely/start', (req, res) => {
  const clientId = process.env.ELY_OAUTH_CLIENT_ID
  const redirectUri = process.env.ELY_OAUTH_REDIRECT_URI
  const enabled = Boolean(clientId && process.env.ELY_OAUTH_CLIENT_SECRET && redirectUri)
  if (!enabled) {
    if (String(req.query.redirect || '') === '1') {
      return redirectToFrontend(res, { auth: 'error', reason: 'oauth_not_configured' })
    }
    return res.status(501).json({ enabled: false, error: 'ely oauth is not configured' })
  }

  const state = crypto.randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'account_info',
    state
  })

  setCookie(res, OAUTH_STATE_COOKIE, state, { maxAge: 10 * 60 })

  const url = `https://account.ely.by/oauth2/v1?${params.toString()}`
  if (String(req.query.redirect || '') === '1') return res.redirect(url)
  res.json({ enabled: true, url })
})

app.get('/api/auth/ely/callback', async (req, res) => {
  const code = String(req.query.code || '')
  const state = String(req.query.state || '')
  const clientId = process.env.ELY_OAUTH_CLIENT_ID
  const clientSecret = process.env.ELY_OAUTH_CLIENT_SECRET
  const redirectUri = process.env.ELY_OAUTH_REDIRECT_URI

  if (!code) {
    console.warn('[oauth] callback missing code')
    return redirectToFrontend(res, { auth: 'error', reason: 'missing_code' })
  }
  if (!(clientId && clientSecret && redirectUri)) {
    console.warn('[oauth] callback but oauth not configured')
    return redirectToFrontend(res, { auth: 'error', reason: 'oauth_not_configured' })
  }
  const cookies = readCookies(req)
  if (!state || state !== cookies[OAUTH_STATE_COOKIE]) {
    console.warn('[oauth] invalid state cookie')
    return redirectToFrontend(res, { auth: 'error', reason: 'invalid_state' })
  }

  try {
    const tokenRes = await fetch('https://account.ely.by/api/oauth2/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
      }),
      signal: AbortSignal.timeout(Number(process.env.POLL_TIMEOUT_MS || 8000))
    })

    if (!tokenRes.ok) {
      const txt = await tokenRes.text()
      console.error('[oauth] token exchange failed', tokenRes.status, txt.slice(0, 200))
      return redirectToFrontend(res, { auth: 'error', reason: 'token_exchange' })
    }

    const token = await tokenRes.json()
    const userRes = await fetch('https://account.ely.by/api/account/v1/info', {
      headers: { Authorization: `Bearer ${token?.access_token}` },
      signal: AbortSignal.timeout(Number(process.env.POLL_TIMEOUT_MS || 8000))
    })

    if (!userRes.ok) {
      const txt = await userRes.text()
      console.error('[oauth] userinfo failed', userRes.status, txt.slice(0, 200))
      return redirectToFrontend(res, { auth: 'error', reason: 'userinfo' })
    }

    const profile = await userRes.json()
    const nick = String(profile?.username || profile?.name || '').trim().slice(0, 24)
    if (!nick) {
      console.error('[oauth] userinfo missing username')
      return redirectToFrontend(res, { auth: 'error', reason: 'missing_username' })
    }

    const payload = { nick, iat: Date.now() }
    const session = makeSessionToken(payload)
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
  res.json({ authenticated: true, nick: user.nick, avatar: `https://craft.ely.by/api/player/head/${encodeURIComponent(user.nick)}` })
})

app.post('/api/logout', (_req, res) => {
  clearCookie(res, SESSION_COOKIE)
  res.json({ ok: true })
})

app.get('/api/stats/history', async (req, res) => {
  const host = String(req.query.host || '').trim()
  const port = Number(req.query.port || 25565)
  const hours = Math.max(1, Math.min(24 * 7, Number(req.query.hours || 24)))

  if (!host) return res.status(400).json({ error: 'host is required' })
  if (!(hasDb && pool)) return res.json({ points: [], peak: 0 })

  const serverId = await getServerId(host, port)
  if (!serverId) return res.json({ points: [], peak: 0 })

  const q = await pool.query(
    `SELECT EXTRACT(EPOCH FROM ts) * 1000 AS t, players_online AS v, online
     FROM server_samples
     WHERE server_id = $1 AND ts >= NOW() - ($2::text || ' hours')::interval
     ORDER BY ts ASC`,
    [serverId, String(hours)]
  )

  const points = q.rows.map((r) => ({ t: Number(r.t), v: Number(r.v) }))
  const peak = points.reduce((acc, p) => Math.max(acc, p.v), 0)
  const transitions = q.rows.map((r) => Boolean(r.online))
  let offlines = 0
  let onlineSince = null
  const uptimes = []
  for (let i = 0; i < q.rows.length; i++) {
    const row = q.rows[i]
    const isOnline = Boolean(row.online)
    const ts = Number(row.t)
    const prev = i > 0 ? Boolean(q.rows[i - 1].online) : null
    if (isOnline && !prev && onlineSince === null) onlineSince = ts
    if (!isOnline && prev) {
      offlines += 1
      if (onlineSince) {
        uptimes.push(Math.floor((ts - onlineSince) / 1000))
      }
      onlineSince = null
    }
  }

  const avgUptimeSec = uptimes.length ? Math.floor(uptimes.reduce((a, b) => a + b, 0) / uptimes.length) : 0
  res.json({ points, peak, offlines, avgUptimeSec, onlineSamples: transitions.length })
})

app.get('/api/servers', async (_req, res) => {
  if (!(hasDb && pool)) return res.json([])
  const q = await pool.query('SELECT host, port, label, is_active FROM servers ORDER BY host, port')
  res.json(q.rows)
})

app.get('/api/stats/players', async (req, res) => {
  const host = String(req.query.host || '').trim()
  const port = Number(req.query.port || 25565)
  if (!host) return res.status(400).json({ error: 'host is required' })
  if (!(hasDb && pool)) return res.json([])
  const serverId = await getServerId(host, port)
  if (!serverId) return res.json([])
  
  const q = await pool.query(
    `SELECT nick, EXTRACT(EPOCH FROM started_at) * 1000 AS started_at, EXTRACT(EPOCH FROM ended_at) * 1000 AS ended_at
     FROM player_sessions
     WHERE server_id = $1
     ORDER BY started_at DESC
     LIMIT 50`,
     [serverId]
  )
  res.json(q.rows.map(r => ({ nick: r.nick, start: Number(r.started_at), end: r.ended_at ? Number(r.ended_at) : null })))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`mc-monitor-api listening on ${PORT}`)
})

bootstrap().catch((err) => {
  console.error('bootstrap error', err)
})

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function getServerStatus({ host, port, source }) {
  // Always try direct connection first if possible, to get real ping
  let directPing = null;
  let directData = null;
  try {
    const res = await util.status(host, port, { timeout: 3000, enableSRV: true });
    directPing = res.roundTripLatency;
    directData = {
        source: 'direct',
        online: true,
        host,
        port,
        ping: directPing,
        favicon: res.favicon || null,
        motd: {
            raw: res.motd?.raw || '',
            clean: res.motd?.clean || ''
        },
        players: buildPlayers({
            online: res.players?.online,
            max: res.players?.max,
            sample: res.players?.sample
        })
    }
  } catch (e) {
    // direct failed
  }

  if (source === 'direct' && directData) return directData;
  if (source === 'ismcserver') {
      const ismc = normalizeIsmc(await fromIsmc(host, port), host, port);
      if (directData) {
          ismc.ping = directPing;
          ismc.details = { direct: directData, ismcserver: ismc };
      }
      return ismc;
  }
  if (source === 'mcstatus') {
      const mc = normalizeMcstatus(await fromMcstatus(host, port), host, port);
      if (directData) {
          mc.ping = directPing;
          mc.details = { direct: directData, mcstatus: mc };
      }
      return mc;
  }

  // Auto
  if (directData) {
      try {
          const ismc = normalizeIsmc(await fromIsmc(host, port), host, port);
          directData.details = { direct: { ...directData }, ismcserver: ismc };
      } catch (e) {}
      return directData;
  }

  try {
    return normalizeIsmc(await fromIsmc(host, port), host, port)
  } catch {
    return normalizeMcstatus(await fromMcstatus(host, port), host, port)
  }
}

async function fromIsmc(host, port) {
  const token = process.env.ISMCSERVER_TOKEN
  if (!token) throw new Error('ISMCSERVER_TOKEN missing')
  const url = `https://api.ismcserver.online/${encodeURIComponent(host)}:${encodeURIComponent(port)}`
  const r = await fetch(url, {
    headers: { Authorization: token },
    signal: AbortSignal.timeout(Number(process.env.POLL_TIMEOUT_MS || 8000))
  })
  if (!r.ok) throw new Error(`ismcserver ${r.status}`)
  return r.json()
}

async function fromMcstatus(host, port) {
  const url = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}:${encodeURIComponent(port)}`
  const r = await fetch(url, { signal: AbortSignal.timeout(Number(process.env.POLL_TIMEOUT_MS || 8000)) })
  if (!r.ok) throw new Error(`mcstatus ${r.status}`)
  return r.json()
}

function mapPlayerEntry(p) {
  if (p == null) return null
  if (typeof p === 'string') {
    const t = p.trim()
    return t ? t.slice(0, 32) : null
  }
  if (typeof p !== 'object') return null
  const name = p.name ?? p.username ?? p.displayName ?? p.profile?.name
  if (typeof name === 'string' && name.trim()) return name.trim().slice(0, 32)
  const id = p.id ?? p.uuid
  if (typeof id === 'string') {
    const hex = id.replace(/-/g, '')
    if (/^[0-9a-f]{8,32}$/i.test(hex)) {
      return `…${hex.slice(-8)}`
    }
  }
  return null
}

function buildPlayers(rawPlayers) {
  const rawList = rawPlayers?.list ?? rawPlayers?.sample ?? []
  const list = Array.isArray(rawList) ? rawList.map(mapPlayerEntry).filter(Boolean) : []
  const online = Number(rawPlayers?.online || 0)
  const max = Number(rawPlayers?.max || 0)
  const listHidden = online > 0 && list.length === 0
  return { online, max, list, listHidden }
}

function normalizeIsmc(raw, host, port) {
  return {
    source: 'ismcserver',
    online: Boolean(raw?.online),
    host: raw?.host || host,
    port: raw?.port || port,
    ping: raw?.ping ?? null,
    favicon: raw?.favicon || null,
    motd: {
      raw: raw?.motd?.raw || '',
      clean: raw?.motd?.clean || raw?.motd?.raw || ''
    },
    players: buildPlayers(raw?.players)
  }
}

function normalizeMcstatus(raw, host, port) {
  return {
    source: 'mcstatus',
    online: Boolean(raw?.online),
    host: raw?.host || host,
    port: raw?.port || port,
    ping: raw?.latency ?? raw?.ping ?? null,
    favicon: raw?.icon || null,
    motd: {
      raw: raw?.motd?.raw || raw?.motd?.clean || '',
      clean: raw?.motd?.clean || raw?.motd?.raw || ''
    },
    players: buildPlayers(raw?.players)
  }
}

async function bootstrap() {
  if (hasRedis) {
    await connectRedis()
    redisSubscriber = redis.duplicate()
    await redisSubscriber.connect()
    await redisSubscriber.subscribe('chat:messages', (message) => {
      try {
        const msg = JSON.parse(message)
        broadcastChat(msg)
      } catch {
        // ignore malformed pubsub message
      }
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
    `INSERT INTO servers(host, port)
     VALUES($1, $2)
     ON CONFLICT(host, port)
     DO UPDATE SET updated_at = NOW()`,
    [host, port]
  )
}

async function getServerId(host, port) {
  const q = await pool.query('SELECT id FROM servers WHERE host = $1 AND port = $2 LIMIT 1', [host, port])
  return q.rows[0]?.id || null
}

function broadcastChat(msg) {
  const payload = `event: message\ndata: ${JSON.stringify(msg)}\n\n`
  for (const client of chatClients) {
    client.write(payload)
  }
}

function readCookies(req) {
  const header = req.headers.cookie || ''
  return Object.fromEntries(
    header
      .split(';')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((kv) => {
        const i = kv.indexOf('=')
        if (i < 0) return [kv, '']
        return [kv.slice(0, i), decodeURIComponent(kv.slice(i + 1))]
      })
  )
}

function makeSessionToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = sign(body)
  return `${body}.${sig}`
}

function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!timingSafeEqual(sign(body), sig)) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!parsed?.nick) return null
    return parsed
  } catch {
    return null
  }
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url')
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

function setCookie(res, name, value, options = {}) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax'
  ]
  if (process.env.NODE_ENV === 'production') attrs.push('Secure')
  if (options.maxAge) attrs.push(`Max-Age=${Math.floor(options.maxAge)}`)
  const existing = res.getHeader('Set-Cookie')
  const list = Array.isArray(existing) ? existing : existing ? [existing] : []
  list.push(attrs.join('; '))
  res.setHeader('Set-Cookie', list)
}

function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 })
}

function getUserFromRequest(req) {
  const cookies = readCookies(req)
  return verifySessionToken(cookies[SESSION_COOKIE])
}
