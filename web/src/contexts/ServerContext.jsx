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

  // Reset stats/sessions on server change - load from DB, not localStorage
  useEffect(() => {
    // Don't use localStorage for stats anymore - will be loaded from DB
    setStats(defaultStats())
  }, [hostPort])

  // Don't persist sessions to localStorage anymore - use DB only
  // useEffect(() => {
  //   const sessK = sessionsKey(hostPort)
  //   writeJson(sessK, sessions)
  // }, [sessions, hostPort])

  // Don't update stats with real-time data - use DB data only
  // Stats will be loaded from API in App.jsx when stats tab is opened

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
