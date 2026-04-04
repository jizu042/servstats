import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ServerCard from './components/ServerCard'
import PlayerModal from './components/PlayerModal'
import StatsPanel from './components/StatsPanel'
import ChatPanel from './components/ChatPanel'
import SettingsPanel from './components/SettingsPanel'
import DetailsPanel from './components/DetailsPanel'
import {
  fetchChatMessages,
  fetchElyAuthStatus,
  fetchMe,
  fetchServerStatus,
  fetchStatsHistory,
  fetchPlayersStats,
  getChatStreamUrl,
  getElyLoginStartUrl,
  logout,
  postChatMessage
} from './lib/api'
import { parseHostPort } from './lib/format'
import {
  K,
  defaultStats,
  getOnlineSinceKey,
  readJson,
  sessionsKey,
  statsKey,
  writeJson
} from './lib/storage'
import { notifyServerOnline, requestNotificationPermission } from './lib/notifications'
import { getT } from './i18n'

const DEFAULTS = {
  hostPort:      import.meta.env.VITE_DEFAULT_SERVER || 'play.hypixel.net:25565',
  pollSec:       Number(import.meta.env.VITE_DEFAULT_POLL_INTERVAL_SEC || 10),
  notifyOnOnline: false,
  theme:         import.meta.env.VITE_DEFAULT_THEME || 'dark',
  apiSource:     import.meta.env.VITE_API_SOURCE_DEFAULT || 'auto',
  lang:          import.meta.env.VITE_DEFAULT_LANG || 'ru'
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

const TABS = [
  { key: 'dashboard', icon: '🏠', labelKey: 'dashboard' },
  { key: 'stats',     icon: '📊', labelKey: 'stats' },
  { key: 'chat',      icon: '💬', labelKey: 'chat' },
  { key: 'details',   icon: '🔍', labelKey: 'details' },
  { key: 'map',       icon: '🗺️', labelKey: 'map' },
]

function lastOpenSessionStart(sessions, nick) {
  const arr = sessions?.[nick]
  if (!arr?.length) return undefined
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!arr[i].end) return arr[i].start
  }
  return undefined
}

export default function App() {
  const [tab, setTab]               = useState('dashboard')
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings]     = useState(() => ({ ...DEFAULTS, ...readJson(K.settings, {}) }))
  const [server, setServer]         = useState(null)
  const prevOnlineRef               = useRef(false)
  const pollPrimedRef               = useRef(false)
  const [onlineSince, setOnlineSince] = useState(null)
  const [activeNick, setActiveNick] = useState('')
  const [sessions, setSessions]     = useState({})
  const [stats, setStats]           = useState(() => defaultStats())
  const [chat, setChat]             = useState([])
  const [rangeHours, setRangeHours] = useState(24)
  const [statsLoading, setStatsLoading] = useState(false)
  const [auth, setAuth]             = useState({ enabled: false })
  const [me, setMe]                 = useState(null)
  const [authBanner, setAuthBanner] = useState(null)
  const [chatLoadState, setChatLoadState]   = useState('loading')
  const [chatStreamState, setChatStreamState] = useState({ status: 'connecting' })
  const [sendError, setSendError]   = useState('')
  const [ipHidden, setIpHidden]     = useState(false)
  const [playersList, setPlayersList] = useState([])

  const hp       = useMemo(() => parseHostPort(settings.hostPort), [settings.hostPort])
  const hostPort = `${hp.host}:${hp.port}`
  const sk       = statsKey(hostPort)
  const sessK    = sessionsKey(hostPort)
  const t        = useMemo(() => getT(settings.lang), [settings.lang])

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    writeJson(K.settings, settings)
  }, [settings])

  // Reset on server change
  useEffect(() => {
    pollPrimedRef.current = false
    prevOnlineRef.current = false
    const since = localStorage.getItem(getOnlineSinceKey(hostPort))
    setOnlineSince(since ? Number(since) : null)
    setStats(readJson(sk, defaultStats()))
    setSessions(readJson(sessK, {}))
    setServer(null)
    setActiveNick('')
  }, [hostPort, sk, sessK])

  // Handle OAuth redirect params
  useEffect(() => {
    const params    = new URLSearchParams(window.location.search)
    const authParam = params.get('auth')
    if (!authParam) return
    const merged = { ...DEFAULTS, ...readJson(K.settings, {}) }
    const tr     = getT(merged.lang)
    if (authParam === 'ok') {
      setAuthBanner({ type: 'success', text: tr.auth.signedInSuccess })
      fetchMe(API_BASE).then((u) => { if (u?.authenticated) setMe({ nick: u.nick, avatar: u.avatar }) }).catch(() => {})
    } else if (authParam === 'error') {
      const reason = params.get('reason') || 'unknown'
      setAuthBanner({ type: 'error', text: tr.auth.errors[reason] || tr.auth.errors.unknown })
    }
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // Escape closes settings
  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setSettingsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen])

  // Polling server status
  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const data     = await fetchServerStatus(API_BASE, hp.host, hp.port, settings.apiSource)
        if (stop) return
        const isOnline = Boolean(data.online)
        setServer(data)

        // Use DB-sourced onlineSince if available
        if (typeof data.onlineSince === 'number' && data.onlineSince > 0) {
          setOnlineSince(data.onlineSince)
          localStorage.setItem(getOnlineSinceKey(hostPort), String(data.onlineSince))
        }

        const sinceKey = getOnlineSinceKey(hostPort)

        if (!pollPrimedRef.current) {
          pollPrimedRef.current = true
          if (isOnline) {
            if (!localStorage.getItem(sinceKey)) localStorage.setItem(sinceKey, String(Date.now()))
            setOnlineSince(Number(localStorage.getItem(sinceKey)))
          } else {
            localStorage.removeItem(sinceKey)
            setOnlineSince(null)
          }
          prevOnlineRef.current = isOnline
        } else {
          if (!prevOnlineRef.current && isOnline) {
            if (!localStorage.getItem(sinceKey)) localStorage.setItem(sinceKey, String(Date.now()))
            setOnlineSince(Number(localStorage.getItem(sinceKey)))
            if (settings.notifyOnOnline) notifyServerOnline(hostPort)
          }
          if (prevOnlineRef.current && !isOnline) {
            setStats((old) => {
              const start  = Number(localStorage.getItem(sinceKey) || 0)
              const upSec  = start ? Math.floor((Date.now() - start) / 1000) : 0
              const uptimes = upSec > 0 ? [...(old.uptimes || []), upSec] : old.uptimes || []
              const avg    = uptimes.length ? Math.floor(uptimes.reduce((a, b) => a + b, 0) / uptimes.length) : 0
              const hh = String(Math.floor(avg / 3600)).padStart(2, '0')
              const mm = String(Math.floor((avg % 3600) / 60)).padStart(2, '0')
              const ss = String(avg % 60).padStart(2, '0')
              const updated = { ...old, offlines: (old.offlines || 0) + 1, uptimes, avgUptime: `${hh}:${mm}:${ss}` }
              writeJson(sk, updated)
              return updated
            })
            localStorage.removeItem(sinceKey)
            setOnlineSince(null)
          }
          prevOnlineRef.current = isOnline
        }

        if (isOnline) {
          setStats((old) => {
            const point      = { t: Date.now(), v: Number(data?.players?.online || 0) }
            const history24h = [...(old.history24h || []), point].slice(-24 * 60 * 6)
            const peak       = Math.max(old.peak || 0, point.v)
            const updated    = { ...old, history24h, peak }
            writeJson(sk, updated)
            return updated
          })
          const names = data?.players?.list || []
          setSessions((old) => {
            const next = { ...old }
            const now  = Date.now()
            for (const nick of names) {
              if (!next[nick] || !next[nick].length || next[nick][next[nick].length - 1].end) {
                next[nick] = [...(next[nick] || []), { start: now, end: null }]
              }
            }
            for (const nick of Object.keys(next)) {
              if (!names.includes(nick) && next[nick].length && !next[nick][next[nick].length - 1].end) {
                next[nick][next[nick].length - 1].end = now
              }
            }
            writeJson(sessK, next)
            return next
          })
        }
      } catch {
        if (!stop) setServer({ online: false, players: { online: 0, max: 0, list: [], listHidden: false }, ping: null, motd: { clean: 'No data' } })
      }
    }
    tick()
    const id = setInterval(tick, Math.max(5, settings.pollSec) * 1000)
    return () => { stop = true; clearInterval(id) }
  }, [hp.host, hp.port, settings.pollSec, settings.notifyOnOnline, settings.apiSource, hostPort, sk, sessK])

  // Chat setup
  const loadChatHistory = useCallback(() => {
    setChatLoadState('loading')
    fetchChatMessages(API_BASE)
      .then((rows) => {
        setChat(Array.isArray(rows) && rows.length ? rows : [{ nick: 'System', text: t.chat.systemWelcome, ts: Date.now() }])
        setChatLoadState('ready')
      })
      .catch(() => setChatLoadState('error'))
  }, [t.chat.systemWelcome])

  useEffect(() => {
    let cancelled = false, es = null, retryTimer = null, attempt = 0
    fetchElyAuthStatus(API_BASE).then((a) => { if (!cancelled) setAuth(a) }).catch(() => {})
    fetchMe(API_BASE).then((u) => { if (!cancelled && u?.authenticated) setMe({ nick: u.nick, avatar: u.avatar }) }).catch(() => {})
    loadChatHistory()

    const connect = () => {
      if (cancelled) return
      es?.close()
      setChatStreamState({ status: attempt > 0 ? 'reconnecting' : 'connecting' })
      es = new EventSource(getChatStreamUrl(API_BASE), { withCredentials: true })
      es.addEventListener('hello', () => { attempt = 0; if (!cancelled) setChatStreamState({ status: 'live' }) })
      es.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data)
          setChat((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.nick === msg.nick && last.text === msg.text && last.ts === msg.ts) return prev
            return [...prev, msg].slice(-200)
          })
        } catch { /* ignore */ }
      })
      es.onerror = () => {
        es.close()
        if (cancelled) return
        attempt += 1
        setChatStreamState({ status: 'error', attempt })
        retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)))
      }
    }
    connect()
    return () => { cancelled = true; clearTimeout(retryTimer); es?.close() }
  }, [loadChatHistory])

  // Stats history
  useEffect(() => {
    if (tab !== 'stats') return
    const ac = new AbortController()
    setStatsLoading(true)
    fetchStatsHistory(API_BASE, hp.host, hp.port, rangeHours, ac.signal)
      .then((res) => {
        if (!res || !Array.isArray(res.points)) return
        setStats((old) => {
          const avg = Number(res?.avgUptimeSec || 0)
          const hh = String(Math.floor(avg / 3600)).padStart(2, '0')
          const mm = String(Math.floor((avg % 3600) / 60)).padStart(2, '0')
          const ss = String(avg % 60).padStart(2, '0')
          const updated = {
            ...old,
            history24h: res.points,
            peak:       Math.max(Number(res.peak || 0), old.peak || 0),
            offlines:   Number(res.offlines ?? 0),
            avgUptime:  avg ? `${hh}:${mm}:${ss}` : old.avgUptime
          }
          writeJson(sk, updated)
          return updated
        })
      })
      .catch((err) => { if (err?.name !== 'AbortError') console.warn('[stats]', err) })
      .finally(() => setStatsLoading(false))
    return () => ac.abort()
  }, [tab, hp.host, hp.port, rangeHours, sk])

  // Load DB player sessions for stats
  useEffect(() => {
    if (tab !== 'stats') return
    fetchPlayersStats(API_BASE, hp.host, hp.port)
      .then((rows) => { if (Array.isArray(rows)) setPlayersList(rows) })
      .catch(() => {})
  }, [tab, hp.host, hp.port])

  const activeSession = activeNick ? lastOpenSessionStart(sessions, activeNick) : undefined

  const TAB_TITLES = {
    dashboard: t.tabs.dashboard,
    stats:     t.tabs.stats,
    chat:      t.tabs.chat,
    details:   t.tabs.details || 'Подробности',
    map:       t.tabs.map
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <nav
        className={`sidebar${sidebarExpanded ? ' expanded' : ''}`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div className="sidebar-logo-wrap">
          <div className="sidebar-logo" title="MC Monitor">⛏️</div>
          <span className="sidebar-logo-text">MC Monitor</span>
        </div>

        <div className="sidebar-nav">
          {TABS.map(({ key, icon, labelKey }) => (
            <button
              key={key}
              type="button"
              className={`sidebar-item${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
              title={TAB_TITLES[key]}
            >
              <span className="sidebar-icon">{icon}</span>
              <span className="sidebar-label">{TAB_TITLES[key]}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-divider" />
        <div className="sidebar-bottom">
          {me?.nick && (
            <div className="sidebar-user">
              {me.avatar
                ? <img className="sidebar-user-avatar" src={me.avatar} alt="" />
                : <span className="sidebar-icon">👤</span>
              }
              <span className="sidebar-user-nick">@{me.nick}</span>
            </div>
          )}
          <button
            type="button"
            className="sidebar-item"
            onClick={() => setSettingsOpen(true)}
            title={t.settings.openSettings}
          >
            <span className="sidebar-icon">⚙️</span>
            <span className="sidebar-label">{t.settings.title}</span>
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className={`main-content${sidebarExpanded ? ' sidebar-expanded' : ''}`}>
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">{TAB_TITLES[tab]}</span>
            <div className="topbar-subtitle">
              <span
                className={`ip-text mono${ipHidden ? ' blurred' : ''}`}
                title={ipHidden ? '' : hostPort}
              >
                {ipHidden ? '••••••••••••' : hostPort}
              </span>
              <button
                type="button"
                className="eye-btn"
                onClick={() => setIpHidden((v) => !v)}
                title={ipHidden ? 'Показать IP' : 'Скрыть IP (режим стримера)'}
              >
                {ipHidden ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="topbar-right">
            {server?.online
              ? <span className="badge badge-green"><span className="badge-dot" />Online</span>
              : <span className="badge"><span className="badge-dot" style={{ background: '#f87171' }} />Offline</span>
            }
            {me?.nick
              ? <span className="badge badge-purple">@{me.nick}</span>
              : null
            }
            <button
              type="button"
              className="icon-btn"
              title={t.settings.openSettings}
              onClick={() => setSettingsOpen(true)}
            >
              ⚙️
            </button>
          </div>
        </header>

        {/* Auth banner */}
        {authBanner && (
          <div className={`auth-banner ${authBanner.type}`} role="status">
            <span>{authBanner.text}</span>
            <button type="button" className="banner-close" onClick={() => setAuthBanner(null)}>✕</button>
          </div>
        )}

        {/* Page content */}
        <main className="page-content fade-in">
          {tab === 'dashboard' && (
            <ServerCard
              server={server}
              hostPort={hostPort}
              onlineSince={onlineSince}
              sessions={sessions}
              labels={t.server}
              onPlayerClick={setActiveNick}
            />
          )}

          {tab === 'stats' && (
            <StatsPanel
              stats={{ ...stats, rangeHours, setRangeHours }}
              playersList={playersList}
              labels={t.stats}
              loading={statsLoading}
              onPlayerClick={setActiveNick}
            />
          )}

          {tab === 'chat' && (
            <ChatPanel
              profile={me || (auth?.enabled ? null : { nick: 'Guest' })}
              messages={chat}
              authEnabled={auth?.enabled}
              labels={t.chat}
              loadState={chatLoadState}
              streamState={chatStreamState}
              sendError={sendError}
              onRetryLoad={loadChatHistory}
              onPlayerClick={setActiveNick}
              onLogin={() => { window.location.href = getElyLoginStartUrl(API_BASE) }}
              onLogout={async () => {
                try { await logout(API_BASE); setMe(null); setAuthBanner({ type: 'success', text: t.auth.signedOut }) } catch { /* ignore */ }
              }}
              onSend={async (text) => {
                setSendError('')
                try {
                  const msg = await postChatMessage(API_BASE, me?.nick || 'Guest', text)
                  setChat((m) => [...m, msg])
                } catch {
                  setSendError(t.chat.sendFailed)
                  throw new Error('send failed')
                }
              }}
            />
          )}

          {tab === 'details' && (
            <DetailsPanel
              apiBase={API_BASE}
              host={hp.host}
              port={hp.port}
              labels={t.details || {}}
            />
          )}

          {tab === 'map' && (
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">{t.tabs.map}</h2>
              </div>
              <div className="no-data-placeholder">
                <span className="no-data-icon">🗺️</span>
                <span>{t.mapReserved}</span>
              </div>
            </section>
          )}
        </main>

        {/* Mobile bottom nav */}
        <nav className="mobile-nav">
          {TABS.map(({ key, icon }) => (
            <button
              key={key}
              type="button"
              className={`mobile-nav-item${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              <span className="mobile-nav-item-icon">{icon}</span>
              <span>{TAB_TITLES[key]}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Settings drawer ── */}
      {settingsOpen && (
        <div className="drawer-backdrop" onClick={() => setSettingsOpen(false)}>
          <aside className="drawer" role="dialog" aria-label={t.settings.title} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>{t.settings.title}</h2>
              <button type="button" className="btn-ghost" onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <SettingsPanel
              settings={settings}
              labels={t.settings}
              me={me}
              authEnabled={auth?.enabled}
              onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
              onAskNotifications={requestNotificationPermission}
              onLogin={() => { window.location.href = getElyLoginStartUrl(API_BASE) }}
              onLogout={async () => {
                try { await logout(API_BASE); setMe(null) } catch { /* ignore */ }
              }}
            />
          </aside>
        </div>
      )}

      {/* ── Player modal ── */}
      <PlayerModal
        nick={activeNick}
        apiBase={API_BASE}
        host={hp.host}
        port={hp.port}
        sessionSince={activeSession}
        history={sessions[activeNick] || []}
        labels={t.player}
        onClose={() => setActiveNick('')}
      />
    </div>
  )
}
