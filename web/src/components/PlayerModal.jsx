import { useEffect, useRef, useState } from 'react'
import { SkinViewer, WalkingAnimation } from 'skinview3d'
import { formatUptime } from '../lib/format'

function headUrl(nick) {
  return `https://craft.ely.by/api/player/head/${encodeURIComponent(nick)}`
}

function elySkinUrl(nick) {
  return `https://craft.ely.by/api/player/skin/${encodeURIComponent(nick)}`
}

function mcHeadsSkinUrl(nick) {
  return `https://mc-heads.net/skin/${encodeURIComponent(nick)}`
}

export default function PlayerModal({ nick, sessionSince, history, onClose, labels }) {
  const l = labels || {}
  const canvasRef = useRef(null)
  const viewerRef = useRef(null)
  const [skinFailed, setSkinFailed] = useState(false)

  useEffect(() => {
    if (!nick || !canvasRef.current) return undefined

    const canvas = canvasRef.current
    const w = Math.min(440, canvas.parentElement?.clientWidth || 440)
    const h = 320

    const viewer = new SkinViewer({
      canvas,
      width: w,
      height: h,
      background: 0x121826
    })
    viewer.animation = new WalkingAnimation()
    viewerRef.current = viewer
    setSkinFailed(false)

    const loadFallbackChain = () =>
      viewer
        .loadSkin(elySkinUrl(nick))
        .catch(() => viewer.loadSkin(mcHeadsSkinUrl(nick)))
        .catch(() => {
          setSkinFailed(true)
          return viewer.loadSkin(mcHeadsSkinUrl('Steve'))
        })
        .catch(() => {})

    loadFallbackChain()

    const ro = new ResizeObserver(() => {
      const nw = Math.min(440, canvas.parentElement?.clientWidth || 440)
      viewer.width = nw
      viewer.height = h
    })
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    return () => {
      ro.disconnect()
      viewer.dispose()
      viewerRef.current = null
    }
  }, [nick])

  if (!nick) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-labelledby="player-modal-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" onClick={onClose}>
          ✕
        </button>
        <div className="modal-player-title" id="player-modal-title">
          <img className="modal-head" src={headUrl(nick)} alt="" width={40} height={40} />
          <h3>{nick}</h3>
        </div>
        <div className="skin-canvas-wrap">
          <canvas ref={canvasRef} className="skin-canvas" />
        </div>
        {skinFailed && <p className="muted small skin-fallback-note">{l.skinLoadError}</p>}
        <p>
          <b>{l.currentSession}:</b> {formatUptime(sessionSince)}
        </p>
        <h4>{l.sessionHistory}</h4>
        <ul className="session-list">
          {(history || [])
            .slice(-10)
            .reverse()
            .map((it, idx) => (
              <li key={`${it.start}-${idx}`} className="mono">
                {new Date(it.start).toLocaleString()} → {it.end ? new Date(it.end).toLocaleString() : l.now}
              </li>
            ))}
          {(!history || history.length === 0) && <li className="muted">{l.noLocalHistory}</li>}
        </ul>
        <div className="placeholder">{l.discordReserved}</div>
      </div>
    </div>
  )
}
