export const K = {
  settings: 'msm_settings',
  stats: 'msm_stats_v1',
  sessions: 'msm_player_sessions_v1'
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
