export async function fetchServerStatus(baseUrl, host, port, source = 'auto') {
  const url = `${baseUrl.replace(/\/$/, '')}/api/status?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}&source=${encodeURIComponent(source)}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch status')
  return res.json()
}

export async function fetchChatMessages(baseUrl) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat/messages`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch chat')
  return res.json()
}

export async function postChatMessage(baseUrl, nick, text) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ nick, text })
  })
  if (!res.ok) throw new Error('Failed to send chat')
  return res.json()
}

export async function fetchStatsHistory(baseUrl, host, port, hours = 24) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/stats/history?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}&hours=${encodeURIComponent(hours)}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch stats history')
  return res.json()
}

export async function fetchElyAuthStatus(baseUrl) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/auth/ely/status`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch auth status')
  return res.json()
}

export async function fetchMe(baseUrl) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/me`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch user')
  return res.json()
}

export async function logout(baseUrl) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/logout`, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error('Failed to logout')
  return res.json()
}

export function getChatStreamUrl(baseUrl) {
  return `${baseUrl.replace(/\/$/, '')}/api/chat/stream`
}

export function getElyLoginStartUrl(baseUrl) {
  return `${baseUrl.replace(/\/$/, '')}/api/auth/ely/start?redirect=1`
}

export async function requestElyStart(baseUrl) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/auth/ely/start`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to init ely login')
  return res.json()
}
