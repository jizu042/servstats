import { useEffect, useRef } from 'react'
import { formatUptime } from '../lib/format'

export default function PlayerModal({ nick, sessionSince, history, onClose, labels }) {
  const l = labels || {
    currentSession: 'Current session',
    sessionHistory: 'Session history',
    noLocalHistory: 'No local history yet',
    now: 'now',
    discordReserved: 'Discord status: reserved'
  }
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!nick || !canvasRef.current) return

    let disposed = false
    let viewer = null
    let onResize = null

    const setup = async () => {
      const skinview3d = await import('skinview3d')
      if (disposed || !canvasRef.current) return

      const width = canvasRef.current.clientWidth || 560
      const height = canvasRef.current.clientHeight || 320

      viewer = new skinview3d.SkinViewer({
        canvas: canvasRef.current,
        width,
        height,
        skin: `https://craft.ely.by/skins/${encodeURIComponent(nick)}.png`
      })

      viewer.zoom = 0.85
      viewer.fov = 55
      viewer.controls.enableZoom = false
      viewer.controls.enablePan = false

      const walk = new skinview3d.WalkingAnimation()
      walk.speed = 1.3
      viewer.animation = walk

      onResize = () => {
        if (!canvasRef.current || !viewer) return
        viewer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight)
      }

      window.addEventListener('resize', onResize)
    }

    setup().catch(() => {})

    return () => {
      disposed = true
      if (onResize) window.removeEventListener('resize', onResize)
      if (viewer) viewer.dispose()
    }
  }, [nick])

  if (!nick) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>✕</button>
        <h3 className="player-title">
          <img src={`https://craft.ely.by/api/player/head/${encodeURIComponent(nick)}`} alt={nick} />
          <span>{nick}</span>
        </h3>
        <div className="skin-render-wrap">
          <canvas ref={canvasRef} className="skin-render" />
        </div>
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
