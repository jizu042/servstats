const STRIP_MC = /§[0-9A-FK-OR]/gi

export function stripMcCodes(text = '') {
  return String(text).replace(STRIP_MC, '')
}

export function formatUptime(since) {
  if (!since) return '—'
  const ms = Date.now() - Number(since)
  if (ms < 0) return '00:00:00'
  const sec = Math.floor(ms / 1000)
  const h = String(Math.floor(sec / 3600)).padStart(2, '0')
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function parseHostPort(value) {
  const fallback = { host: 'play.hypixel.net', port: 25565 }
  if (!value || !value.includes(':')) return fallback
  const [host, portRaw] = value.split(':')
  const port = Number(portRaw)
  if (!host || Number.isNaN(port)) return fallback
  return { host: host.trim(), port }
}
