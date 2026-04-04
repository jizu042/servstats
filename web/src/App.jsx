import { useEffect, useMemo, useRef, useState } from 'react'
import ServerCard from './components/ServerCard'
import PlayerModal from './components/PlayerModal'
import StatsPanel from './components/StatsPanel'
import ChatPanel from './components/ChatPanel'
import SettingsPanel from './components/SettingsPanel'
import {
  fetchChatMessages,
  fetchElyAuthStatus,
  fetchMe,
  fetchServerStatus,
  fetchStatsHistory,
  getChatStreamUrl,
  logout,
  postChatMessage,
  requestElyStart
} from './lib/api'
import { parseHostPort } from './lib/format'
import { K, getOnlineSinceKey, readJson, readScopedJson, writeJson, writeScopedJson } from './lib/storage'
import { notifyServerOnline, requestNotificationPermission } from './lib/notifications'
import { getT } from './i18n'

const DEFAULTS = {
  hostPort: import.meta.env.VITE_DEFAULT_SERVER || 'play.hypixel.net:25565',
  pollSec: Number(import.meta.env.VITE_DEFAULT_POLL_INTERVAL_SEC || 10),
  notifyOnOnline: false,
  theme: import.meta.env.VITE_DEFAULT_THEME || 'dark',
  apiSource: import.meta.env.VITE_API_SOURCE_DEFAULT || 'auto',
  lang: import.meta.env.VITE_DEFAULT_LANG || 'ru'
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
const DEFAULT_STATS = { history24h: [], peak: 0, offlines: 0, avgUptime: '—', uptimes: [] }

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...readJson(K.settings, {}) }))
  const [server, setServer] = useState(null)
  const prevOnlineRef = useRef(false)
  const [onlineSince, setOnlineSince] = useState(null)
  const [activeNick, setActiveNick] = useState('')
  const [sessions, setSessions] = useState({})
  const [stats, setStats] = useState(DEFAULT_STATS)
  const [chat, setChat] = useState([{ nick: 'System', text: 'Welcome to local chat demo.' }])
  const [chatLoading, setChatLoading] = useState(true)
  const [chatError, setChatError] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [sseState, setSseState] = useState('connecting')
  const [rangeHours, setRangeHours] = useState(24)
  const [auth, setAuth] = useState({ enabled: false })
  const [authError, setAuthError] = useState('')
  const [me, setMe] = useState(null)
  const sseRef = useRef(null)
  const sseRetryRef = useRef(null)
  const sseAttemptsRef = useRef(0)

  const hp = useMemo(() => parseHostPort(settings.hostPort), [settings.hostPort])
  const hostPort = `${hp.host}:${hp.port}`
  const t = useMemo(() => getT(settings.lang), [settings.lang])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    writeJson(K.settings, settings)
  }, [settings])

  useEffect(() => {
    const existing = localStorage.getItem(getOnlineSinceKey(hostPort))
    setOnlineSince(existing ? Number(existing) : null)
    setStats(readScopedJson(K.statsByServer, hostPort, DEFAULT_STATS))
    setSessions(readScopedJson(K.sessionsByServer, hostPort, {}))
    prevOnlineRef.current = false
  }, [hostPort])

  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const data = await fetchServerStatus(API_BASE, hp.host, hp.port, settings.apiSource)
        if (stop) return
        const isOnline = Boolean(data.online)
        setServer(data)

        if (!prevOnlineRef.current && isOnline) {
          const now = Date.now()
          localStorage.setItem(getOnlineSinceKey(hostPort), String(now))
          setOnlineSince(now)
          if (settings.notifyOnOnline) notifyServerOnline(hostPort)
        }

        if (prevOnlineRef.current && !isOnline) {
          setStats((old) => {
            const start = Number(localStorage.getItem(getOnlineSinceKey(hostPort)) || 0)
            const upSec = start ? Math.floor((Date.now() - start) / 1000) : 0
            const uptimes = upSec > 0 ? [...old.uptimes, upSec] : old.uptimes
            const avg = uptimes.length ? Math.floor(uptimes.reduce((a, b) => a + b, 0) / uptimes.length) : 0
            const hh = String(Math.floor(avg / 3600)).padStart(2, '0')
            const mm = String(Math.floor((avg % 3600) / 60)).padStart(2, '0')
            const ss = String(avg % 60).padStart(2, '0')
            const updated = { ...old, offlines: (old.offlines || 0) + 1, uptimes, avgUptime: `${hh}:${mm}:${ss}` }
            writeScopedJson(K.statsByServer, hostPort, updated)
            return updated
          })
          localStorage.removeItem(getOnlineSinceKey(hostPort))
          setOnlineSince(null)
        }

        if (isOnline) {
          setStats((old) => {
            const point = { t: Date.now(), v: Number(data?.players?.online || 0) }
            const limit = 24 * 60 * 6
            const history24h = [...old.history24h, point].slice(-limit)
            const peak = Math.max(old.peak || 0, point.v)
            const updated = { ...old, history24h, peak }
            writeScopedJson(K.statsByServer, hostPort, updated)
            return updated
          })

          const names = data?.players?.list || []
          setSessions((old) => {
            const next = { ...old }
            const now = Date.now()
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
            writeScopedJson(K.sessionsByServer, hostPort, next)
            return next
          })
        }

        prevOnlineRef.current = isOnline
      } catch {
        if (!stop) {
          setServer({ online: false, players: { online: 0, max: 0, list: [] }, ping: null, motd: { clean: 'No data' } })
        }
      }
    }

    tick()
    const id = setInterval(tick, Math.max(5, settings.pollSec) * 1000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [hp.host, hp.port, settings.pollSec, settings.notifyOnOnline, settings.apiSource, hostPort])

  useEffect(() => {
    let mounted = true
    fetchElyAuthStatus(API_BASE)
      .then((a) => {
        if (mounted) setAuth(a)
      })
      .catch(() => {})

    fetchMe(API_BASE)
      .then((u) => {
        if (mounted && u?.authenticated) setMe({ nick: u.nick, avatar: u.avatar })
      })
      .catch(() => {})

    fetchChatMessages(API_BASE)
      .then((rows) => {
        if (mounted && Array.isArray(rows) && rows.length) setChat(rows)
        if (mounted) {
          setChatLoading(false)
          setChatError('')
        }
      })
      .catch(() => {
        if (mounted) {
          setChatLoading(false)
          setChatError(t.chat.loadError)
        }
      })

    const connectSse = () => {
      if (!mounted) return
      setSseState('connecting')
      const stream = new EventSource(getChatStreamUrl(API_BASE), { withCredentials: true })
      sseRef.current = stream

      stream.onopen = () => {
        sseAttemptsRef.current = 0
        setSseState('connected')
      }

      stream.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data)
          setChat((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.nick === msg.nick && last.text === msg.text && last.ts === msg.ts) return prev
            const next = [...prev, msg]
            return next.slice(-200)
          })
        } catch {
          // ignore malformed messages
        }
      })

      stream.onerror = () => {
        stream.close()
        setSseState('reconnecting')
        sseAttemptsRef.current += 1
        const retryMs = Math.min(15000, 1000 * 2 ** Math.min(5, sseAttemptsRef.current))
        sseRetryRef.current = setTimeout(connectSse, retryMs)
      }
    }

    connectSse()

    return () => {
      mounted = false
      if (sseRetryRef.current) clearTimeout(sseRetryRef.current)
      if (sseRef.current) sseRef.current.close()
    }
  }, [t.chat.loadError])

  useEffect(() => {
    const u = new URL(window.location.href)
    const auth = u.searchParams.get('auth')
    if (!auth) return

    if (auth === 'ok') {
      fetchMe(API_BASE)
        .then((meData) => {
          if (meData?.authenticated) {
            setMe({ nick: meData.nick, avatar: meData.avatar })
            setAuthError('')
          }
        })
        .catch(() => {})
    }

    if (auth === 'error') {
      setAuthError(t.chat.authNotReady)
    }

    u.searchParams.delete('auth')
    u.searchParams.delete('reason')
    window.history.replaceState({}, '', u.toString())
  }, [t.chat.authNotReady])

  useEffect(() => {
    if (tab !== 'stats') return
    fetchStatsHistory(API_BASE, hp.host, hp.port, rangeHours)
      .then((res) => {
        if (!res?.points) return
        setStats((old) => {
          const avg = Number(res?.avgUptimeSec || 0)
          const hh = String(Math.floor(avg / 3600)).padStart(2, '0')
          const mm = String(Math.floor((avg % 3600) / 60)).padStart(2, '0')
          const ss = String(avg % 60).padStart(2, '0')
          const hasBackendData = Array.isArray(res.points) && res.points.length > 0
          const updated = hasBackendData
            ? {
                ...old,
                history24h: res.points,
                peak: Number(res.peak || 0),
                offlines: Number(res.offlines || 0),
                avgUptime: avg ? `${hh}:${mm}:${ss}` : '—'
              }
            : old
          writeScopedJson(K.statsByServer, hostPort, updated)
          return updated
        })
      })
      .catch(() => {})
  }, [tab, hp.host, hp.port, rangeHours, hostPort])

  const activeSession = activeNick && sessions[activeNick]?.findLast((s) => !s.end)?.start
  const recentPlayers = useMemo(() => {
    return Object.entries(sessions)
      .map(([nick, hist]) => ({ nick, last: hist?.[hist.length - 1]?.start || 0 }))
      .sort((a, b) => b.last - a.last)
      .slice(0, 8)
      .map((x) => x.nick)
  }, [sessions])

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>{t.appTitle}</h1>
          <p className="muted mono header-sub">{hostPort}</p>
        </div>
        <div className="topbar-badges">
          <span className="chip mono">API: {settings.apiSource}</span>
          <span className="chip">{me?.nick ? `@${me.nick}` : 'Guest'}</span>
          <button className="settings-trigger" onClick={() => setIsSettingsOpen(true)} aria-label={t.settingsButton}>⚙ {t.settingsButton}</button>
        </div>
        <nav className="tabs">
          {['dashboard', 'stats', 'chat', 'map'].map((tabKey) => (
            <button key={tabKey} className={tab === tabKey ? 'active' : ''} onClick={() => setTab(tabKey)}>{t.tabs[tabKey]}</button>
          ))}
        </nav>
      </header>

      {tab === 'dashboard' && (
        <ServerCard
          server={server}
          hostPort={hostPort}
          onlineSince={onlineSince}
          labels={t.server}
          recentPlayers={recentPlayers}
          onPlayerClick={setActiveNick}
        />
      )}

      {tab === 'stats' && <StatsPanel stats={{ ...stats, rangeHours, setRangeHours }} labels={t.stats} />}

      {tab === 'chat' && (
        <ChatPanel
          profile={me}
          messages={chat}
          chatLoading={chatLoading}
          chatError={chatError}
          sending={chatSending}
          sseState={sseState}
          canSend={!auth?.enabled || Boolean(me?.nick)}
          authEnabled={auth?.enabled}
          authError={authError}
          labels={t.chat}
          onNickClick={setActiveNick}
          onLogin={async () => {
            try {
              const start = await requestElyStart(API_BASE)
              if (!start?.enabled || !start?.url) {
                setAuthError(t.chat.authNotReady)
                return
              }
              window.location.href = start.url
            } catch {
              setAuthError(t.chat.authNotReady)
            }
          }}
          onLogout={async () => {
            try {
              await logout(API_BASE)
              setMe(null)
              setAuthError('')
            } catch {
              // ignore
            }
          }}
          onSend={async (text) => {
            setChatSending(true)
            setChatError('')
            try {
              const msg = await postChatMessage(API_BASE, me?.nick || 'Guest', text)
              setChat((m) => [...m, msg])
            } catch {
              setChatError(t.chat.sendError)
            } finally {
              setChatSending(false)
            }
          }}
        />
      )}

      {tab === 'map' && <section className="card"><h3>{t.tabs.map}</h3><p className="muted">{t.mapReserved}</p></section>}

      {isSettingsOpen && !activeNick && (
        <div className="drawer-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <aside className="settings-drawer" onClick={(e) => e.stopPropagation()}>
            <SettingsPanel
              settings={settings}
              labels={t.settings}
              onClose={() => setIsSettingsOpen(false)}
              onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
              onAskNotifications={requestNotificationPermission}
            />
          </aside>
        </div>
      )}

      <PlayerModal
        nick={activeNick}
        sessionSince={activeSession}
        history={sessions[activeNick] || []}
        labels={t.player}
        onClose={() => setActiveNick('')}
      />
    </main>
  )
}
