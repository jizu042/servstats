
import express from 'express'
import cors from 'cors'
import crypto from 'node:crypto'
import { closeDb, connectRedis, hasDb, hasRedis, pool, redis } from './db.js'
import util from 'minecraft-server-util'
import { startCollector } from './collector.js'

const app = express()
const PORT = Number(process.env.PORT || 8787)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const SESSION_COOKIE = 'msm_session'
const OAUTH_STATE_COOKIE = 'msm_oauth_state'
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'
const FRONTEND_URL = (process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
const ALLOWED_ORIGINS = [FRONTEND_URL, 'https://mc-monitor-web.onrender.com', 'http://localhost:5173'].map(o => o?.replace(/\/$/, ''))

const chatClients = new Set()

function redirectToFrontend(res, searchParams) {
  const q = new URLSearchParams(searchParams)
  return res.redirect(`${FRONTEND_URL}/?${q.toString()}`)
}

let redisSubscriber = null

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))) return cb(null, true)
    cb(null, true) // Fallback to true to allow development if origin header is missing
  },
  credentials: true
}))
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

    // DB: save sample and compute real onlineSince from server_samples
    if (hasDb && pool) {
      await ensureServer({ host: data.host, port: data.port })
      const serverId = await getServerId(data.host, data.port)

      if (serverId) {
        // Save current sample to DB (auto-collect without worker)
        try {
          await pool.query(
            `INSERT INTO server_samples(server_id, ts, online, players_online, players_max, ping_ms, source)
             VALUES($1, NOW(), $2, $3, $4, $5, $6)`,
            [serverId, data.online, data.players.online, data.players.max, data.ping, data.source]
          )
          console.log(`[status] sample saved: ${host}:${port} online=${data.online} players=${data.players.online}`)
        } catch (err) {
          console.error(`[status] failed to save sample:`, err.message)
        }

        if (data.online) {
          // Server is online - find start of current online streak
          const uptimeRes = await pool.query(
            `SELECT ts, online FROM server_samples
             WHERE server_id = $1
             ORDER BY ts DESC LIMIT 300`,
            [serverId]
          )

          if (uptimeRes.rows.length > 0) {
            let onlineSince = Date.now()
            let foundOffline = false

            // Walk backwards to find the start of online streak
            for (const row of uptimeRes.rows) {
              if (!row.online) {
                foundOffline = true
                break
              }
              onlineSince = new Date(row.ts).getTime()
            }

            // If all samples are online, use the oldest sample time
            data.onlineSince = onlineSince
            console.log(`[status] ${host}:${port} online since ${new Date(onlineSince).toISOString()} (${foundOffline ? 'found offline' : 'all samples online'})`)
          } else {
            // No samples yet - server just came online
            data.onlineSince = Date.now()
            console.log(`[status] ${host}:${port} no samples yet, using current time`)
          }

          // Track player sessions (simple version without worker)
          if (data.players.list && data.players.list.length > 0) {
            try {
              for (const nick of data.players.list) {
                if (!nick || !nick.trim()) continue

                // Check if player already has an open session
                const existingSession = await pool.query(
                  `SELECT id FROM player_sessions
                   WHERE server_id = $1 AND nick = $2 AND ended_at IS NULL`,
                  [serverId, nick]
                )

                if (existingSession.rows.length === 0) {
                  // Open new session
                  await pool.query(
                    `INSERT INTO player_sessions(server_id, nick, started_at)
                     VALUES($1, $2, NOW())`,
                    [serverId, nick]
                  )
                  console.log(`[status] session opened: ${nick}`)
                }
              }
            } catch (err) {
              console.error(`[status] failed to track sessions:`, err.message)
            }
          }
        } else {
          // Server is offline
          data.onlineSince = null
        }
      } else {
        // Server not in DB yet
        data.onlineSince = data.online ? Date.now() : null
      }
    } else {
      // No DB - use current time if online
      data.onlineSince = data.online ? Date.now() : null
    }
    res.json(data)
  } catch (e) {
    console.error('[status] failed', e?.message || e)
    res.status(500).json({ error: 'failed to fetch status' })
  }
})

// ── /api/chat/stream ────────────────────────────────────────────────────────
app.get('/api/chat/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  chatClients.add(res)
  res.write('event: hello\ndata: {"ok":true}\n\n')

  req.on('close', () => chatClients.delete(res))
})

app.get('/api/chat/messages', async (_req, res) => {
  if (hasDb && pool) {
    const q = await pool.query(
      'SELECT nick, text, EXTRACT(EPOCH FROM ts) * 1000 AS ts, is_verified, image_url, image_width, image_height FROM chat_messages ORDER BY ts DESC LIMIT 100'
    )
    return res.json(q.rows.reverse().map((r) => ({
      nick: r.nick,
      text: r.text,
      ts: Number(r.ts),
      verified: Boolean(r.is_verified),
      imageUrl: r.image_url,
      imageWidth: r.image_width,
      imageHeight: r.image_height
    })))
  }
  res.json([])
})

app.post('/api/chat/messages', async (req, res) => {
  try {
    const me     = getUserFromRequest(req)
    const isAuth = Boolean(me?.nick)
    const authEnabled = Boolean(process.env.ELY_OAUTH_CLIENT_ID)

    let nick = 'Guest'
    if (isAuth) {
      nick = me.nick.slice(0, 24)
    } else if (authEnabled) {
      nick = 'Guest'
    } else {
      nick = String(req.body?.nick || 'Guest').trim().slice(0, 24) || 'Guest'
    }

    const text = String(req.body?.text || '').trim().slice(0, 300)
    const imageUrl = String(req.body?.imageUrl || '').trim().slice(0, 500)
    const imageWidth = Number(req.body?.imageWidth) || null
    const imageHeight = Number(req.body?.imageHeight) || null

    // Must have either text or image
    if (!text && !imageUrl) {
      return res.status(400).json({ error: 'text or image is required' })
    }

    const msg = {
      nick,
      text: text || null,
      ts: Date.now(),
      verified: isAuth,
      imageUrl: imageUrl || null,
      imageWidth,
      imageHeight
    }

    if (hasDb && pool) {
      await pool.query(
        'INSERT INTO chat_messages(nick, text, ts, is_verified, image_url, image_width, image_height) VALUES($1, $2, TO_TIMESTAMP($3 / 1000.0), $4, $5, $6, $7)',
        [nick, msg.text, msg.ts, isAuth, msg.imageUrl, msg.imageWidth, msg.imageHeight]
      )
      // Broadcast only once - either via Redis or directly
      if (redis?.isOpen) {
        await redis.publish('chat:messages', JSON.stringify(msg))
      } else {
        broadcastChat(msg)
      }
      return res.status(201).json(msg)
    }
    broadcastChat(msg)
    res.status(201).json(msg)
  } catch (e) {
    console.error('[chat] post failed', e?.message || e)
    res.status(500).json({ error: 'failed to save' })
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
  if (!clientId || !redirectUri) {
    if (String(req.query.redirect || '') === '1') return redirectToFrontend(res, { auth: 'error', reason: 'oauth_not_configured' })
    return res.status(501).json({ enabled: false, error: 'ely oauth not configured' })
  }
  const state  = crypto.randomBytes(16).toString('hex')
  const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: 'account_info', state })
  setCookie(res, OAUTH_STATE_COOKIE, state, { maxAge: 10 * 60 })
  const url = `https://account.ely.by/oauth2/v1?${params.toString()}`
  if (String(req.query.redirect || '') === '1') return res.redirect(url)
  res.json({ enabled: true, url })
})

app.get('/api/auth/ely/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code) return redirectToFrontend(res, { auth: 'error', reason: 'no_code' })
  const cookies = readCookies(req)
  // If state doesn't match, it could be a cross-origin cookie block, but Ely redirect is same-site Lax compliant.
  if (!state || state !== cookies[OAUTH_STATE_COOKIE]) return redirectToFrontend(res, { auth: 'error', reason: 'invalid_state' })

  const clientId     = process.env.ELY_OAUTH_CLIENT_ID
  const clientSecret = process.env.ELY_OAUTH_CLIENT_SECRET
  const redirectUri  = process.env.ELY_OAUTH_REDIRECT_URI

  try {
    const tokenRes = await fetch('https://account.ely.by/api/oauth2/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      })
    })
    const data = await tokenRes.json()
    if (!data.access_token) return redirectToFrontend(res, { auth: 'error', reason: 'token_exchange_failed' })

    const userRes = await fetch('https://account.ely.by/api/account/v1/info', {
      headers: { Authorization: `Bearer ${data.access_token}` }
    })
    const userData = await userRes.json()
    const nick = userData.username || userData.name
    if (!nick) return redirectToFrontend(res, { auth: 'error', reason: 'no_username' })

    const session = makeSessionToken({ nick, iat: Date.now() })
    clearCookie(res, OAUTH_STATE_COOKIE)
    setCookie(res, SESSION_COOKIE, session, { maxAge: 60 * 60 * 24 * 7 })
    return redirectToFrontend(res, { auth: 'ok', token: session })
  } catch (err) {
    console.error('Ely.by OAuth error:', err)
    return redirectToFrontend(res, { auth: 'error', reason: 'oauth_internal_error' })
  }
})

app.get('/api/me', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user) return res.json({ authenticated: false })

  // Use our skin proxy (loads from Ely.by first, then Minotar)
  const baseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || `http://localhost:${PORT}`
  const avatar = `${baseUrl}/api/skin/${encodeURIComponent(user.nick)}`

  res.json({
    authenticated: true,
    nick:   user.nick,
    avatar: avatar
  })
})

app.post('/api/logout', (_req, res) => {
  clearCookie(res, SESSION_COOKIE)
  res.json({ ok: true })
})

// ── Skin proxy (bypass CORS) ────────────────────────────────────────────────
app.get('/api/skin/:nick', async (req, res) => {
  const nick = req.params.nick
  if (!nick) return res.status(400).send('nick is required')

  try {
    // Use ONLY Ely.by
    const elyUrl = `https://skinsystem.ely.by/skins/${encodeURIComponent(nick)}.png`
    const elyRes = await fetch(elyUrl)

    if (elyRes.ok) {
      const buffer = await elyRes.arrayBuffer()
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=3600')
      res.setHeader('Access-Control-Allow-Origin', '*')
      return res.send(Buffer.from(buffer))
    }

    res.status(404).send('Skin not found on Ely.by')
  } catch (err) {
    console.error('[skin-proxy] error:', err.message)
    res.status(500).send('Failed to fetch skin from Ely.by')
  }
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
    if (row.online) {
      if (onlineSince === null) onlineSince = Number(row.t)
    } else {
      if (onlineSince !== null) {
        offlines++
        uptimes.push(Math.floor((Number(row.t) - onlineSince) / 1000))
        onlineSince = null
      }
    }
  }
  const avgUptimeSec = uptimes.length ? Math.floor(uptimes.reduce((a, b) => a + b, 0) / uptimes.length) : 0
  res.json({ points, peak, offlines, avgUptimeSec })
})

app.get('/api/stats/players', async (req, res) => {
  const host = String(req.query.host || '').trim()
  const port = Number(req.query.port || 25565)
  if (!host || !(hasDb && pool)) return res.json([])

  try {
    const serverId = await getServerId(host, port)
    if (!serverId) return res.json([])

    const q = await pool.query(
      `SELECT nick, EXTRACT(EPOCH FROM started_at) * 1000 AS start, EXTRACT(EPOCH FROM ended_at) * 1000 AS end
       FROM player_sessions
       WHERE server_id = $1 AND nick IS NOT NULL AND nick != ''
       ORDER BY started_at DESC
       LIMIT 1000`,
      [serverId]
    )

    const sessions = q.rows.map((r) => ({
      nick: r.nick,
      start: Number(r.start),
      end: r.end ? Number(r.end) : null
    }))

    console.log(`[stats/players] Returning ${sessions.length} sessions for ${host}:${port}`)
    res.json(sessions)
  } catch (err) {
    console.error('[stats/players] Error:', err)
    res.json([])
  }
})

app.get('/api/stats/players/:nick/sessions', async (req, res) => {
  const host = String(req.query.host || '').trim()
  const port = Number(req.query.port || 25565)
  const nick = String(req.params.nick || '').trim()
  if (!host || !nick || !(hasDb && pool)) return res.json([])
  const serverId = await getServerId(host, port)
  if (!serverId) return res.json([])

  const q = await pool.query(
    `SELECT EXTRACT(EPOCH FROM started_at) * 1000 AS start, EXTRACT(EPOCH FROM ended_at) * 1000 AS end
     FROM player_sessions WHERE server_id = $1 AND nick = $2 ORDER BY started_at DESC LIMIT 100`,
    [serverId, nick]
  )
  res.json(q.rows.map((r) => ({ start: Number(r.start), end: r.end ? Number(r.end) : null })))
})

// ── Details ─────────────────────────────────────────────────────────────
app.get('/api/details', async (req, res) => {
  const host = String(req.query.host || '').trim()
  const port = Number(req.query.port || 25565)
  if (!host) return res.status(400).json({ error: 'host is required' })

  const [direct, ismc, mcstatus, mcsrvstat] = await Promise.allSettled([
    fetchDirect(host, port, 4000),
    fetchIsmcDetails(host, port, 4000),
    fetchMcstatusDetails(host, port, 4000),
    fetchMcsrvstatDetails(host, port, 4000)
  ])

  res.json({
    direct:    direct.status === 'fulfilled' ? direct.value : null,
    ismcserver: ismc.status === 'fulfilled' ? ismc.value : null,
    mcstatus:  mcstatus.status === 'fulfilled' ? mcstatus.value : null,
    mcsrvstat: mcsrvstat.status === 'fulfilled' ? mcsrvstat.value : null
  })
})

// ── Bootstrap & shutdown ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => console.log(`mc-monitor-api listening on ${PORT}`))

bootstrap().catch((err) => console.error('bootstrap error', err))

async function bootstrap() {
  if (hasDb && pool && process.env.MONITOR_SERVERS) {
    startCollector(pool)
  }
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

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// ── Status Logic ─────────────────────────────────────────────────────────────
async function getServerStatus({ host, port, source }) {
  let directData = null
  try {
    const raw = await util.status(host, port, { timeout: 3000, enableSRV: true })
    directData = {
      source: 'direct', pingSource: 'direct', online: true, host, port, ping: raw.roundTripLatency || 0,
      favicon: raw.favicon, motd: { clean: raw.motd?.clean || '', raw: raw.motd?.raw || '' },
      players: buildPlayers(raw.players)
    }
  } catch {}

  if (source === 'direct' && directData) return directData
  
  const sources = []
  if (source === 'auto' || source === 'ismcserver') sources.push(fromIsmc(host, port).then(r => normalizeIsmc(r, host, port)).catch(() => null))
  if (source === 'auto' || source === 'mcstatus')   sources.push(fromMcstatus(host, port).then(r => normalizeMcstatus(r, host, port)).catch(() => null))

  const results = await Promise.all(sources)
  const external = results.find(r => r && r.online)

  if (external) {
    if (directData) {
      if (external.players.list.length === 0 && directData.players.list.length > 0) external.players = directData.players
      if (!external.favicon && directData.favicon) external.favicon = directData.favicon
      if (!external.motd?.clean && directData.motd?.clean) external.motd = directData.motd
    }
    return external
  }
  return directData || { online: false, host, port, players: { online: 0, max: 0, list: [] }, motd: { clean: 'Offline' } }
}

async function fromIsmc(host, port) {
  const token = process.env.ISMCSERVER_TOKEN
  if (!token) throw new Error('ISMCSERVER_TOKEN missing')
  const r = await fetch(`https://api.ismcserver.online/${encodeURIComponent(host)}:${encodeURIComponent(port)}`, {
    headers: { Authorization: token }, signal: AbortSignal.timeout(8000)
  })
  if (!r.ok) throw new Error('ismc failed')
  return r.json()
}

async function fromMcstatus(host, port) {
  const r = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}:${encodeURIComponent(port)}`, {
    signal: AbortSignal.timeout(8000)
  })
  if (!r.ok) throw new Error('mcstatus failed')
  return r.json()
}

async function fetchDirect(host, port, timeout) {
  const raw = await util.status(host, port, { timeout, enableSRV: true })
  return { online: true, host, port, ping: raw.roundTripLatency, version: raw.version?.name, players: buildPlayers(raw.players) }
}

async function fetchIsmcDetails(host, port, timeout) {
  const data = await fromIsmc(host, port)
  return { online: true, source: 'ismcserver', ...data }
}

async function fetchMcstatusDetails(host, port, timeout) {
  const data = await fromMcstatus(host, port)
  return { online: true, source: 'mcstatus', ...data }
}

async function fetchMcsrvstatDetails(host, port, timeout) {
  const r = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(host)}:${encodeURIComponent(port)}`)
  const data = await r.json()
  return { online: data.online, source: 'mcsrvstat', ...data }
}

function buildPlayers(p) {
  const list = (p?.sample || p?.list || []).map(x => x.name || x).filter(Boolean)
  return { online: p?.online || 0, max: p?.max || 0, list }
}

function normalizeIsmc(raw, host, port) {
  return { online: !!raw.online, host, port, ping: raw.ping, pingSource: 'external', players: buildPlayers(raw.players), motd: { clean: raw.motd?.clean || '' } }
}

function normalizeMcstatus(raw, host, port) {
  return { online: !!raw.online, host, port, ping: raw.latency, pingSource: 'external', players: buildPlayers(raw.players), motd: { clean: raw.motd?.clean || '' } }
}

async function ensureServer({ host, port }) {
  await pool.query('INSERT INTO servers(host, port) VALUES($1, $2) ON CONFLICT DO NOTHING', [host, port])
}

async function getServerId(host, port) {
  const q = await pool.query('SELECT id FROM servers WHERE host = $1 AND port = $2', [host, port])
  return q.rows[0]?.id
}

function broadcastChat(msg) {
  const payload = `event: message\ndata: ${JSON.stringify(msg)}\n\n`
  for (const c of chatClients) c.write(payload)
}

function readCookies(req) {
  const result = {}
  if (!req.headers.cookie) return result
  for (const part of req.headers.cookie.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    try {
      result[key] = decodeURIComponent(val)
    } catch {
      result[key] = val
    }
  }
  return result
}

function setCookie(res, name, value, options = {}) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.FRONTEND_URL?.includes('onrender.com')
  const sameSite = isProd ? 'None' : 'Lax'
  const secure = isProd ? 'Secure' : ''
  const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', `SameSite=${sameSite}`]
  if (secure) attrs.push('Secure')
  if (options.maxAge) attrs.push(`Max-Age=${options.maxAge}`)
  res.setHeader('Set-Cookie', attrs.join('; '))
}

function clearCookie(res, name) { setCookie(res, name, '', { maxAge: 0 }) }
function makeSessionToken(p) {
  const b = Buffer.from(JSON.stringify(p)).toString('base64url')
  return `${b}.${crypto.createHmac('sha256', SESSION_SECRET).update(b).digest('base64url')}`
}
function verifySessionToken(t) {
  if (!t || !t.includes('.')) return null
  const [b, s] = t.split('.')
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(b).digest('base64url')
  if (s !== expected) return null
  try { return JSON.parse(Buffer.from(b, 'base64url').toString('utf8')) } catch { return null }
}
function getUserFromRequest(req) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const t = verifySessionToken(authHeader.substring(7))
    if (t) return t
  }
  return verifySessionToken(readCookies(req)[SESSION_COOKIE])
}
