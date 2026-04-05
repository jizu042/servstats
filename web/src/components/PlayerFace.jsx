import { useState } from 'react'

const SKIN_SOURCES = [
  { key: 'ely', url: (nick) => `https://skinsystem.ely.by/skins/${encodeURIComponent(nick)}.png`, needsCrop: true },
  { key: 'minotar', url: (nick, size) => `https://minotar.net/helm/${encodeURIComponent(nick)}/${size}.png`, needsCrop: false },
  { key: 'crafatar', url: (nick, size) => `https://crafatar.com/avatars/${encodeURIComponent(nick)}?size=${size}&overlay`, needsCrop: false },
  { key: 'mcheads', url: (nick, size) => `https://mc-heads.net/avatar/${encodeURIComponent(nick)}/${size}`, needsCrop: false }
]

export default function PlayerFace({ nick, size = 32, style = {} }) {
  const [sourceIndex, setSourceIndex] = useState(0)

  if (!nick || nick === 'Guest' || nick === 'System') {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: size >= 32 ? 6 : 4,
          background: 'var(--bg-3)', color: 'var(--text-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.5, fontWeight: 'bold', flexShrink: 0, ...style
        }}
      >
        {nick ? nick[0].toUpperCase() : '?'}
      </div>
    )
  }

  const currentSource = SKIN_SOURCES[sourceIndex]
  const scale = size / 8

  const handleError = () => {
    if (sourceIndex < SKIN_SOURCES.length - 1) {
      setSourceIndex(sourceIndex + 1)
    }
  }

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
        ...style
      }}
      title={nick}
    >
      <img
        src={currentSource.url(nick, size)}
        key={currentSource.key}
        alt={nick}
        onError={handleError}
        style={
          currentSource.needsCrop
            ? { width: 64 * scale, height: 64 * scale, marginLeft: -8 * scale, marginTop: -8 * scale, imageRendering: 'pixelated', display: 'block', maxWidth: 'none' }
            : { width: size, height: size, imageRendering: 'pixelated', display: 'block' }
        }
      />
    </div>
  )
}
