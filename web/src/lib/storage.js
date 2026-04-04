export const K = {
  settings: 'msm_settings',
  statsByServer: 'msm_stats_by_server_v2',
  sessionsByServer: 'msm_sessions_by_server_v2'
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

export function readScopedJson(baseKey, scope, fallback) {
  const all = readJson(baseKey, {})
  return all?.[scope] ?? fallback
}

export function writeScopedJson(baseKey, scope, value) {
  const all = readJson(baseKey, {})
  all[scope] = value
  writeJson(baseKey, all)
}
