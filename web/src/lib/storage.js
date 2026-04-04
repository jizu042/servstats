export const K = {
  settings: 'msm_settings',
  stats: 'msm_stats_v1',
  sessions: 'msm_player_sessions_v1'
}

export function defaultStats() {
  return { history24h: [], peak: 0, offlines: 0, avgUptime: '—', uptimes: [] }
}

export function statsKey(hostPort) {
  return `${K.stats}::${hostPort}`
}

export function sessionsKey(hostPort) {
  return `${K.sessions}::${hostPort}`
}

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getOnlineSinceKey(hostPort) {
  return `server_online_since_${hostPort}`
}
