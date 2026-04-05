import { useEffect, useRef, useState } from 'react'
import { SkinViewer, WalkingAnimation } from 'skinview3d'
import { formatUptime } from '../lib/format'
import { fetchPlayerSessions } from '../lib/api'

import PlayerFace from './PlayerFace'

async function loadSkinWithFallback(viewer, nick, apiBase) {
  try {
    // Use API proxy to bypass CORS
    const url = `${apiBase}/api/skin/${encodeURIComponent(nick)}`
    console.log(`[PlayerModal] Loading skin via proxy: ${url}`)

    await viewer.loadSkin(url)
    console.log(`[PlayerModal] ✅ Successfully loaded skin via proxy`)
    return true
  } catch (err) {
    console.error(`[PlayerModal] ❌ Failed to load skin:`, err.message || err)
    return false
  }
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}ч ${m}м`
  return `${m}м`
}

export default function PlayerModal({ nick, apiBase, host, port, sessionSince, history, onClose, labels }) {
  const l         = labels || {}
  const canvasRef = useRef(null)
  const viewerRef = useRef(null)
  const [skinFailed, setSkinFailed]     = useState(false)
  const [dbSessions, setDbSessions]     = useState(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)

  // 3D skin viewer
  useEffect(() => {
    if (!nick || !canvasRef.current) return undefined

    const canvas = canvasRef.current
    const w = Math.min(440, canvas.parentElement?.clientWidth || 440)
    const h = 300

    const viewer = new SkinViewer({ canvas, width: w, height: h, background: 0x080b14 })
    viewer.animation = new WalkingAnimation()
    viewer.animation.speed = 0.7
    viewerRef.current = viewer
    setSkinFailed(false)

    loadSkinWithFallback(viewer, nick, apiBase)
      .then((success) => {
        if (!success) {
          console.warn(`[PlayerModal] Failed to load any skin for ${nick}, showing Steve`)
          setSkinFailed(true)
        }
      })
      .catch((err) => {
        console.error(`[PlayerModal] Error loading skin:`, err)
        setSkinFailed(true)
      })

    const ro = new ResizeObserver(() => {
      viewer.width  = Math.min(440, canvas.parentElement?.clientWidth || 440)
      viewer.height = h
    })
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    return () => { ro.disconnect(); viewer.dispose(); viewerRef.current = null }
  }, [nick, apiBase])

  // Load DB sessions
  useEffect(() => {
    if (!nick || !apiBase || !host) return
    setSessionsLoading(true)
    setDbSessions(null)
    fetchPlayerSessions(apiBase, host, port, nick)
      .then((rows) => setDbSessions(Array.isArray(rows) ? rows : []))
      .catch(() => setDbSessions([]))
      .finally(() => setSessionsLoading(false))
  }, [nick, apiBase, host, port])

  if (!nick) return null

  // Merge DB sessions with local ones; prefer DB
  const allSessions = dbSessions !== null ? dbSessions : history || []
  const totalMs     = allSessions.reduce((sum, s) => {
    const dur = s.end ? (s.end - s.start) : (Date.now() - s.start)
    return sum + Math.max(0, dur)
  }, 0)
  const visitCount  = allSessions.length
  const isOnline    = Boolean(sessionSince)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal fade-in" role="dialog" aria-labelledby="player-modal-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">✕</button>

        {/* Header */}
        <div className="modal-player-header" id="player-modal-title">
          <PlayerFace nick={nick} size={48} style={{ marginRight: 16 }} />
          <div>
            <h3>{nick}</h3>
            {isOnline
              ? <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>🟢 Online · {formatUptime(sessionSince)}</span>
              : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Последний раз видели</span>
            }
          </div>
        </div>

        {/* Stats row */}
        <div className="player-stats-row">
          <div className="player-stat-box">
            <div className="player-stat-val">{visitCount}</div>
            <div className="player-stat-lbl">Визитов</div>
          </div>
          <div className="player-stat-box">
            <div className="player-stat-val">{formatDuration(totalMs)}</div>
            <div className="player-stat-lbl">Всего онлайн</div>
          </div>
          <div className="player-stat-box">
            <div className="player-stat-val" style={{ color: isOnline ? 'var(--accent)' : 'var(--text-3)', fontSize: '1rem' }}>
              {isOnline ? 'Онлайн' : '—'}
            </div>
            <div className="player-stat-lbl">Статус</div>
          </div>
        </div>

        {/* 3D Skin viewer */}
        <div className="skin-canvas-wrap">
          <canvas ref={canvasRef} className="skin-canvas" />
        </div>
        {skinFailed && <p className="skin-fallback-note muted2">⚠️ {l.skinLoadError}</p>}

        {/* Session history */}
        <p className="session-history-title">{l.sessionHistory}</p>

        {sessionsLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 13 }}>
            <span className="spinner" /> Загрузка истории…
          </div>
        )}

        {!sessionsLoading && (
          <ul className="session-list">
            {allSessions.length === 0 && (
              <li style={{ color: 'var(--text-3)', fontSize: 13, listStyle: 'none' }}>{l.noLocalHistory}</li>
            )}
            {allSessions.slice(-15).reverse().map((it, idx) => {
              const dur = it.end ? (it.end - it.start) : (Date.now() - it.start)
              return (
                <li key={`${it.start}-${idx}`} className="session-item">
                  <div className={`session-item-dot${!it.end ? ' active' : ''}`} />
                  <span className="session-time">
                    {new Date(it.start).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {' → '}
                    {it.end
                      ? new Date(it.end).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{l.now}</span>
                    }
                  </span>
                  <span className="session-duration">{formatDuration(dur)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
