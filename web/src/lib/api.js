const base = (url) => url.replace(/\/$/, '')

export async function fetchServerStatus(baseUrl, host, port, source = 'auto') {
  const url = `${base(baseUrl)}/api/status?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}&source=${encodeURIComponent(source)}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch status')
  return res.json()
}

export async function fetchChatMessages(baseUrl) {
  const res = await fetch(`${base(baseUrl)}/api/chat/messages`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch chat')
  return res.json()
}

export async function postChatMessage(baseUrl, nick, text) {
  const res = await fetch(`${base(baseUrl)}/api/chat/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ nick, text })
  })
  if (!res.ok) throw new Error('Failed to send chat')
  return res.json()
}

export async function fetchStatsHistory(baseUrl, host, port, hours = 24, signal) {
  const url = `${base(baseUrl)}/api/stats/history?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}&hours=${encodeURIComponent(hours)}`
  const res = await fetch(url, { credentials: 'include', signal })
  if (!res.ok) throw new Error('Failed to fetch stats history')
  return res.json()
}

export async function fetchElyAuthStatus(baseUrl) {
  const res = await fetch(`${base(baseUrl)}/api/auth/ely/status`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch auth status')
  return res.json()
}

export async function fetchMe(baseUrl) {
  const res = await fetch(`${base(baseUrl)}/api/me`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch user')
  return res.json()
}

export async function logout(baseUrl) {
  const res = await fetch(`${base(baseUrl)}/api/logout`, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error('Failed to logout')
  return res.json()
}

export function getChatStreamUrl(baseUrl) {
  return `${base(baseUrl)}/api/chat/stream`
}

export function getElyLoginStartUrl(baseUrl) {
  return `${base(baseUrl)}/api/auth/ely/start?redirect=1`
}

/** Aggregate stats for all players (from DB player_sessions) */
export async function fetchPlayersStats(baseUrl, host, port) {
  const url = `${base(baseUrl)}/api/stats/players?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch players stats')
  return res.json()
}

/** Session history for a specific player */
export async function fetchPlayerSessions(baseUrl, host, port, nick) {
  const url = `${base(baseUrl)}/api/stats/players/${encodeURIComponent(nick)}/sessions?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch player sessions')
  return res.json()
}

/** Aggregated details from multiple external sources */
export async function fetchDetails(baseUrl, host, port) {
  const url = `${base(baseUrl)}/api/details?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch details')
  return res.json()
}
