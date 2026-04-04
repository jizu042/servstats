import { createContext, useContext, useState, useEffect } from 'react'
import { useServerMonitor } from '../hooks/useServerMonitor'
import { K, readJson, writeJson, defaultStats, statsKey, sessionsKey } from '../lib/storage'
import { parseHostPort } from '../lib/format'

const ServerContext = createContext(null)

export function useServerContext() {
  const context = useContext(ServerContext)
  if (!context) {
    throw new Error('useServerContext must be used within ServerProvider')
  }
  return context
}

const DEFAULTS = {
  hostPort: import.meta.env.VITE_DEFAULT_SERVER || 'play.hypixel.net:25565',
  pollSec: Number(import.meta.env.VITE_DEFAULT_POLL_INTERVAL_SEC || 10),
  notifyOnOnline: false,
  theme: import.meta.env.VITE_DEFAULT_THEME || 'dark',
  apiSource: import.meta.env.VITE_API_SOURCE_DEFAULT || 'auto',
  lang: import.meta.env.VITE_DEFAULT_LANG || 'ru'
}

export function ServerProvider({ children }) {
  // Settings
  const [settings, setSettings] = useState(() => ({
    ...DEFAULTS,
    ...readJson(K.settings, {})
  }))

  // Parse host:port
  const hp = parseHostPort(settings.hostPort)
  const hostPort = `${hp.host}:${hp.port}`

  // Stats state
  const [stats, setStats] = useState(() => defaultStats())

  // Use server monitor hook
  const {
    server,
    onlineSince,
    sessions,
    isPolling,
    error: serverError,
    refetch
  } = useServerMonitor({
    host: hp.host,
    port: hp.port,
    pollIntervalSec: settings.pollSec,
    apiSource: settings.apiSource,
    notifyOnOnline: settings.notifyOnOnline
  })

  // Persist settings to localStorage
  useEffect(() => {
    writeJson(K.settings, settings)
  }, [settings])

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // Reset stats/sessions on server change
  useEffect(() => {
    const sk = statsKey(hostPort)
    const sessK = sessionsKey(hostPort)
    setStats(readJson(sk, defaultStats()))
  }, [hostPort])

  // Persist sessions to localStorage
  useEffect(() => {
    const sessK = sessionsKey(hostPort)
    writeJson(sessK, sessions)
  }, [sessions, hostPort])

  // Update stats with real-time data (minimal buffer for smooth rendering)
  useEffect(() => {
    if (server?.online) {
      setStats((old) => {
        const point = { t: Date.now(), v: Number(server?.players?.online || 0) }
        const history24h = [...(old.history24h || []), point].slice(-24 * 60 * 6)
        const peak = Math.max(old.peak || 0, point.v)
        return { ...old, history24h, peak }
      })
    }
  }, [server])

  const updateSettings = (patch) => {
    setSettings((s) => ({ ...s, ...patch }))
  }

  const value = {
    // Server data
    server,
    onlineSince,
    sessions,
    isPolling,
    serverError,
    refetch,

    // Stats
    stats,
    setStats,

    // Settings
    settings,
    updateSettings,

    // Parsed values
    host: hp.host,
    port: hp.port,
    hostPort
  }

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
}
