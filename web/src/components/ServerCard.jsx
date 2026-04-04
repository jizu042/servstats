import { useMemo } from 'react'
import { formatUptime, stripMcCodes } from '../lib/format'

function headUrl(nick) {
  return `https://craft.ely.by/api/player/head/${encodeURIComponent(nick)}`
}

function recentNicks(sessions, onlineSet, limit = 14) {
  const entries = Object.entries(sessions || {})
    .map(([nick, segs]) => {
      if (!nick || onlineSet.has(nick)) return null
      if (!Array.isArray(segs)) return null
      let lastT = 0
      for (const s of segs) {
        const end = s.end ?? Date.now()
        lastT = Math.max(lastT, end, s.start)
      }
      return { nick, lastT }
    })
    .filter(Boolean)
    .sort((a, b) => b.lastT - a.lastT)
    .slice(0, limit)
    .map((e) => e.nick)
  return entries
}

export default function ServerCard({ server, hostPort, onlineSince, sessions, onPlayerClick, labels }) {
  const l = labels || {}
  const online = Boolean(server?.online)
  const motd = stripMcCodes(server?.motd?.clean || server?.motd?.raw || server?.motd || 'Unknown server')
  const subtitle = stripMcCodes(server?.motd?.html ? '' : server?.motd?.clean?.split('\n')?.[1] || '')

  const list = server?.players?.list || []
  const listHidden = Boolean(server?.players?.listHidden)
  const onlineSet = useMemo(() => new Set(list), [list])
  const recent = useMemo(() => recentNicks(sessions, onlineSet), [sessions, onlineSet])

  return (
    <section className="card fade-in server-card">
      <header className="server-header">
        <div className="server-ident">
          {server?.favicon ? <img className="favicon" src={server.favicon} alt="" /> : <div className="favicon ghost" />}
          <div>
            <h2>{motd}</h2>
            <p className="muted mono">{hostPort}</p>
          </div>
        </div>
        <span className={`status ${online ? 'on' : 'off'}`}>
          <span className="dot" /> {online ? l.online : l.offline}
        </span>
      </header>

      <p className="subtitle">{subtitle || l.subtitleFallback}</p>

      <div className="stats-grid">
        <div>
          <span className="label">{l.players}</span>
          <strong className="tabular-nums">
            {server?.players?.online ?? 0} / {server?.players?.max ?? 0}
          </strong>
        </div>
        <div>
          <span className="label">{l.ping}</span>
          <strong className="tabular-nums">{server?.ping ?? '—'} ms</strong>
        </div>
        <div>
          <span className="label">{l.uptime}</span>
          <strong className="tabular-nums">{online ? formatUptime(onlineSince) : '—'}</strong>
        </div>
      </div>

      <div className="players-wrap">
        <h3>{l.playersOnline}</h3>
        {listHidden && (
          <p className="list-hidden-note">
            <span className="badge-local">{l.recentSeenBadge}</span> {l.listHidden}
          </p>
        )}
        <div className="players-list">
          {list.length === 0 && !listHidden && <p className="muted">{l.noPlayers}</p>}
          {list.map((nick) => (
            <button key={nick} type="button" className="player-chip" onClick={() => onPlayerClick(nick)}>
              <img src={headUrl(nick)} alt="" loading="lazy" width={20} height={20} />
              <span className="player-nick">{nick}</span>
            </button>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="recent-seen">
            <h4>
              {l.recentSeenTitle}{' '}
              <span className="badge-local">{l.recentSeenBadge}</span>
            </h4>
            <p className="muted small recent-hint">{l.recentSeenHint}</p>
            <div className="players-list">
              {recent.map((nick) => (
                <button key={nick} type="button" className="player-chip player-chip-ghost" onClick={() => onPlayerClick(nick)}>
                  <img src={headUrl(nick)} alt="" loading="lazy" width={20} height={20} />
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
