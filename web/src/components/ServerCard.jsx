import { formatUptime, stripMcCodes } from '../lib/format'

export default function ServerCard({ server, hostPort, onlineSince, onPlayerClick, labels }) {
  const l = labels || {
    online: 'Online',
    offline: 'Offline',
    subtitleFallback: 'Minecraft server monitor',
    players: 'Players',
    ping: 'Ping',
    uptime: 'Uptime',
    playersOnline: 'Players online',
    noPlayers: 'No players online'
  }
  const online = Boolean(server?.online)
  const motd = stripMcCodes(server?.motd?.clean || server?.motd?.raw || server?.motd || 'Unknown server')
  const subtitle = stripMcCodes(server?.motd?.html ? '' : server?.motd?.clean?.split('\n')?.[1] || '')

  return (
    <section className="card fade-in">
      <header className="server-header">
        <div className="server-ident">
          {server?.favicon ? <img className="favicon" src={server.favicon} alt="favicon" /> : <div className="favicon ghost" />}
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
          <strong>{server?.players?.online ?? 0} / {server?.players?.max ?? 0}</strong>
        </div>
        <div>
          <span className="label">{l.ping}</span>
          <strong>{server?.ping ?? '—'} ms</strong>
        </div>
        <div>
          <span className="label">{l.uptime}</span>
          <strong>{online ? formatUptime(onlineSince) : '—'}</strong>
        </div>
      </div>

      <div className="players-wrap">
        <h3>{l.playersOnline}</h3>
        <div className="players-list">
          {(server?.players?.list || []).length === 0 && <p className="muted">{l.noPlayers}</p>}
          {(server?.players?.list || []).map((nick) => (
            <button key={nick} className="player-chip" onClick={() => onPlayerClick(nick)}>
              <img src={`https://craft.ely.by/api/player/head/${encodeURIComponent(nick)}`} alt={nick} loading="lazy" />
              <span>{nick}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
