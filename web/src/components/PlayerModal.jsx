import { formatUptime } from '../lib/format'

export default function PlayerModal({ nick, sessionSince, history, onClose, labels }) {
  const l = labels || {
    currentSession: 'Current session',
    sessionHistory: 'Session history',
    noLocalHistory: 'No local history yet',
    now: 'now',
    discordReserved: 'Discord status: reserved'
  }
  if (!nick) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>✕</button>
        <h3>{nick}</h3>
        <iframe
          title={`skin-${nick}`}
          className="skin-render"
          src={`https://minerender.ely.by/render/body/${encodeURIComponent(nick)}`}
        />
        <p><b>{l.currentSession}:</b> {formatUptime(sessionSince)}</p>
        <h4>{l.sessionHistory}</h4>
        <ul>
          {(history || []).slice(-10).reverse().map((it, idx) => (
            <li key={`${it.start}-${idx}`} className="mono">{new Date(it.start).toLocaleString()} → {it.end ? new Date(it.end).toLocaleString() : l.now}</li>
          ))}
          {(!history || history.length === 0) && <li className="muted">{l.noLocalHistory}</li>}
        </ul>
        <div className="placeholder">
          {l.discordReserved}
        </div>
      </div>
    </div>
  )
}
