import { useMemo, useState } from 'react'
import { formatUptime, stripMcCodes } from '../lib/format'

function headUrl(nick) {
  return `https://minotar.net/helm/${encodeURIComponent(nick)}/64.png`
}

function recentNicks(sessions, onlineSet, limit = 14) {
  return Object.entries(sessions || {})
    .map(([nick, segs]) => {
      if (!nick || onlineSet.has(nick) || !Array.isArray(segs)) return null
      let lastT = 0
      for (const s of segs) lastT = Math.max(lastT, s.end ?? Date.now(), s.start)
      return { nick, lastT }
    })
    .filter(Boolean)
    .sort((a, b) => b.lastT - a.lastT)
    .slice(0, limit)
    .map((e) => e.nick)
}

function getPingColor(ping) {
  if (ping === null || ping === undefined) return 'var(--text-3)'
  if (ping < 80)  return 'var(--accent)'
  if (ping < 150) return 'var(--yellow)'
  return 'var(--red)'
}

export default function ServerCard({ server, onlineSince, sessions, onPlayerClick, labels }) {
  const l      = labels || {}
  const online = Boolean(server?.online)
  const motd   = stripMcCodes(server?.motd?.clean || server?.motd?.raw || server?.motd || '')
  const cleanMotd = server?.motd?.clean || ''
  const motdLine2 = stripMcCodes(cleanMotd.split('\n')?.[1] || '')

  const list       = server?.players?.list || []
  const listHidden = Boolean(server?.players?.listHidden)
  const onlineSet  = useMemo(() => new Set(list), [list])
  const recent     = useMemo(() => recentNicks(sessions, onlineSet), [sessions, onlineSet])

  const ping       = server?.ping ?? null
  const pingSource = server?.pingSource || null

  return (
    <section className="card server-card fade-in">
      {/* Header */}
      <div className="server-header">
        <div className="server-ident">
          {server?.favicon
            ? <img className="favicon" src={server.favicon} alt="" />
            : <div className="favicon-ghost">⛏️</div>
          }
          <div>
            <h2>{motd || l.subtitleFallback || 'Minecraft Server'}</h2>
            {motdLine2 && <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-2)' }}>{motdLine2}</p>}
          </div>
        </div>
        <span className={`status-badge ${online ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {online ? l.online : l.offline}
        </span>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric-box">
          <span className="metric-label">{l.players}</span>
          <div className="metric-value">
            <span style={{ color: online ? 'var(--accent)' : 'var(--text-3)' }}>
              {server?.players?.online ?? 0}
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: '0.85em' }}> / {server?.players?.max ?? 0}</span>
          </div>
        </div>

        <div className="metric-box">
          <span className="metric-label">{l.ping}</span>
          <div className="metric-value" style={{ color: getPingColor(ping) }}>
            {ping !== null ? `${ping} ms` : '—'}
          </div>
          {pingSource && (
            <div className="ping-source" title={pingSource === 'direct' ? 'Прямое соединение к серверу' : `Данные получены через ${pingSource}`}>
              {pingSource === 'direct' ? '🔌 direct' : `🌐 ${pingSource}`}
            </div>
          )}
        </div>

        <div className="metric-box">
          <span className="metric-label">{l.uptime}</span>
          <div className="metric-value" style={{ color: online ? 'var(--cyan)' : 'var(--text-3)', fontSize: '1.05rem' }}>
            {online ? formatUptime(onlineSince) : '—'}
          </div>
        </div>
      </div>

      {/* Players online */}
      <div className="players-section">
        <div className="players-header">
          <h3>{l.playersOnline}</h3>
          {list.length > 0 && (
            <span className="players-count-chip">{list.length}</span>
          )}
        </div>

        {listHidden && (
          <div className="list-hidden-note">
            <span className="local-badge">СКРЫТ</span> {l.listHidden}
          </div>
        )}

        <div className="players-grid">
          {list.length === 0 && !listHidden && (
            <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>{l.noPlayers}</p>
          )}
          {list.map((nick) => (
            <button
              key={nick}
              type="button"
              className="player-chip"
              onClick={() => onPlayerClick(nick)}
            >
              <img src={headUrl(nick)} alt="" loading="lazy" width={22} height={22} />
              <span className="player-nick">{nick}</span>
            </button>
          ))}
        </div>

        {/* Recently seen */}
        {recent.length > 0 && (
          <div className="recent-section">
            <div className="recent-title">
              {l.recentSeenTitle}
              <span className="local-badge">{l.recentSeenBadge}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 10px' }}>{l.recentSeenHint}</p>
            <div className="players-grid">
              {recent.map((nick) => (
                <button
                  key={nick}
                  type="button"
                  className="player-chip player-chip-ghost"
                  onClick={() => onPlayerClick(nick)}
                >
                  <img src={headUrl(nick)} alt="" loading="lazy" width={22} height={22} />
                  <span className="player-nick">{nick}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
