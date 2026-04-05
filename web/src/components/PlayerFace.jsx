import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

export default function PlayerFace({ nick, size = 32, style = {}, onClick }) {
  const [failed, setFailed] = useState(false)

  if (!nick || nick === 'Guest' || nick === 'System') {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: size >= 32 ? 6 : 4,
          background: 'var(--bg-3)', color: 'var(--text-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.5, fontWeight: 'bold', flexShrink: 0, ...style
        }}
        onClick={onClick}
      >
        {nick ? nick[0].toUpperCase() : '?'}
      </div>
    )
  }

  if (failed) {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: size >= 32 ? 6 : 4,
          background: 'var(--bg-3)', color: 'var(--text-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.5, fontWeight: 'bold', flexShrink: 0, ...style
        }}
        onClick={onClick}
      >
        {nick[0].toUpperCase()}
      </div>
    )
  }

  // Use API proxy for skin (bypasses CORS)
  const skinUrl = `${API_BASE}/api/skin/${encodeURIComponent(nick)}`
  const scale = size / 8

  return (
    <div
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        display: 'inline-block',
        borderRadius: size >= 32 ? 6 : 4,
        flexShrink: 0,
        backgroundColor: 'var(--bg-3)',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      title={nick}
      onClick={onClick}
    >
      <img
        src={skinUrl}
        alt={nick}
        onError={() => setFailed(true)}
        style={{
          width: 64 * scale,
          height: 64 * scale,
          marginLeft: -8 * scale,
          marginTop: -8 * scale,
          imageRendering: 'pixelated',
          display: 'block',
          maxWidth: 'none'
        }}
      />
    </div>
  )
}
