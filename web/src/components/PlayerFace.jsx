import { useState } from 'react'

export default function PlayerFace({ nick, size = 32, style = {} }) {
  const [failedEly, setFailedEly] = useState(false)
  
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
        ...style
      }}
      title={nick}
    >
      <img
        src={failedEly ? `https://minotar.net/helm/${encodeURIComponent(nick)}/${size}.png` : `http://skinsystem.ely.by/skins/${encodeURIComponent(nick)}.png`}
        key={failedEly ? 'minotar' : 'ely'}
        alt={nick}
        onError={() => { if (!failedEly) setFailedEly(true) }}
        style={
          failedEly
            ? { width: size, height: size, imageRendering: 'pixelated', display: 'block' }
            : { width: 64 * scale, height: 64 * scale, marginLeft: -8 * scale, marginTop: -8 * scale, imageRendering: 'pixelated', display: 'block', maxWidth: 'none' }
        }
      />
    </div>
  )
}
