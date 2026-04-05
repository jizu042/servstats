import { useRef, useState } from 'react'

import PlayerFace from './PlayerFace'

const CLOUDINARY_CLOUD_NAME = 'dbmvzwz2k'
const CLOUDINARY_UPLOAD_PRESET = 'chat_images' // Unsigned preset для загрузки

export default function ChatPanel({
  profile,
  messages,
  onSend,
  onLogin,
  onLogout,
  authEnabled,
  labels,
  loadState,
  streamState,
  sendError,
  onRetryLoad,
  onPlayerClick
}) {
  const l = labels || {}
  const [text, setText] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState(null)
  const scrollRef = useRef(null)
  const fileInputRef = useRef(null)

  const avatarNick = profile?.nick || 'Steve'

  const streamStatus = streamState?.status || 'connecting'
  const streamLabel =
    streamStatus === 'live'         ? l.streamLive :
    streamStatus === 'reconnecting' ? l.streamReconnecting :
    streamStatus === 'error'        ? l.streamError : '…'

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Изображение слишком большое. Максимум 5MB')
      return
    }

    setUploading(true)

    try {
      // Upload to Cloudinary
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      )

      if (!response.ok) throw new Error('Upload failed')

      const data = await response.json()
      setImagePreview({
        url: data.secure_url,
        width: data.width,
        height: data.height
      })
    } catch (err) {
      console.error('Image upload failed:', err)
      alert('Не удалось загрузить изображение')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed && !imagePreview) return

    try {
      await onSend(trimmed, imagePreview)
      setText('')
      setImagePreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      // scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }, 50)
    } catch { /* surfaced via sendError */ }
  }

  return (
    <section className="card chat-card fade-in">
      {/* Header */}
      <div className="chat-header">
        <h2 className="card-title">{l.title}</h2>
        <span className={`stream-pill ${streamStatus}`}>{streamLabel}</span>
      </div>

      {profile?.nick ? (
        <div className="chat-profile-row">
          <div className="chat-profile-ident">
            <PlayerFace nick={avatarNick} size={30} style={{ marginRight: 10, alignSelf: 'center' }} />
            <span style={{ fontSize: 13.5 }}>
              {l.signedInAs || 'Вы вошли как'} <b style={{ color: 'var(--purple)' }}>{profile.nick}</b>
            </span>
          </div>
          {onLogout && (
            <button type="button" className="btn-danger" style={{ padding: '5px 11px', fontSize: 12 }} onClick={onLogout}>
              {l.logout || 'Выйти'}
            </button>
          )}
        </div>
      ) : (
        <div className="chat-guest-block">
          <div className="chat-profile-ident">
            <PlayerFace nick="Steve" size={30} style={{ filter: 'grayscale(1)', marginRight: 10, alignSelf: 'center' }} />
            <span className="muted" style={{ fontSize: 13.5 }}>
              {authEnabled ? (l.signInPrompt || 'Авторизуйтесь через Ely.by для отправки сообщений') : (l.oauthNotConfigured || 'Вход через Ely.by не настроен')}
            </span>
          </div>
          {onLogin && authEnabled && (
            <button type="button" className="btn-primary" style={{ padding: '6px 14px', fontSize: 12.5 }} onClick={onLogin}>
              {l.loginEly || 'Войти через Ely.by'}
            </button>
          )}
        </div>
      )}

      {/* Load states */}
      {loadState === 'loading' && (
        <p className="chat-meta muted">
          <span className="spinner" style={{ marginRight: 8 }} />{l.loadingHistory}
        </p>
      )}
      {loadState === 'error' && (
        <div className="chat-error-banner">
          <span>{l.loadHistoryError}</span>
          <button type="button" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onRetryLoad}>{l.retry}</button>
        </div>
      )}

      {/* Messages */}
      <div className="chat-scroll" ref={scrollRef}>
        {loadState === 'ready' && messages.length === 0 && (
          <p className="chat-meta muted">{l.emptyChat}</p>
        )}
        {messages.map((m, i) => (
          <div className="chat-item" key={`${m.ts}-${i}-${m.nick}`}>
            <PlayerFace
              nick={m.nick}
              size={28}
              style={{ flexShrink: 0, cursor: onPlayerClick ? 'pointer' : 'default', alignSelf: 'flex-start' }}
              onClick={() => onPlayerClick?.(m.nick)}
            />
            <div className="chat-item-body">
              <div className="chat-item-head">
                <b
                  className="chat-nick"
                  onClick={() => onPlayerClick?.(m.nick)}
                  title={`Открыть профиль ${m.nick}`}
                >
                  {m.nick}
                  {m.verified && (
                    <span className="verify-badge" title="Верифицировано через Ely.by">✓</span>
                  )}
                </b>
                <span className="chat-time">
                  {m.ts ? new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              {m.text && <p className="chat-text">{m.text}</p>}
              {m.imageUrl && (
                <img
                  src={m.imageUrl}
                  alt=""
                  className="chat-image"
                  onClick={() => setFullscreenImage(m.imageUrl)}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 300,
                    borderRadius: 8,
                    marginTop: m.text ? 6 : 0,
                    cursor: 'pointer',
                    display: 'block'
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {sendError && <p className="chat-send-error">{sendError}</p>}

      {/* Image preview */}
      {imagePreview && (
        <div style={{ padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={imagePreview.url} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} />
          <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>Изображение готово к отправке</span>
          <button
            type="button"
            onClick={() => {
              setImagePreview(null)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
            style={{ padding: '4px 8px', fontSize: 12, background: 'var(--bg-3)', border: '1px solid var(--card-border)', borderRadius: 4, color: 'var(--text-2)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Send form */}
      <form className="chat-form" onSubmit={handleSubmit}>
        <PlayerFace nick={avatarNick} size={30} style={{ flexShrink: 0, alignSelf: 'center' }} />
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || (!profile?.nick && authEnabled)}
          style={{
            padding: '9px 12px',
            background: 'var(--bg-3)',
            border: '1px solid var(--card-border)',
            borderRadius: 6,
            color: 'var(--text-2)',
            cursor: uploading ? 'wait' : 'pointer',
            fontSize: 16,
            flexShrink: 0
          }}
          title="Прикрепить изображение"
        >
          {uploading ? '⏳' : '📎'}
        </button>
        <input
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={profile?.nick ? l.messagePlaceholder : (authEnabled ? l.signInPrompt : l.messagePlaceholder)}
          disabled={!profile?.nick && authEnabled}
        />
        <button
          type="submit"
          className="btn-primary"
          style={{ padding: '9px 16px', flexShrink: 0 }}
          disabled={(!text.trim() && !imagePreview) || uploading}
        >
          {l.send}
        </button>
      </form>

      {/* Fullscreen image modal */}
      {fullscreenImage && (
        <div
          className="modal-backdrop"
          onClick={() => setFullscreenImage(null)}
          style={{ zIndex: 9999 }}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setFullscreenImage(null)}
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                background: 'rgba(0,0,0,0.7)',
                border: 'none',
                color: 'white',
                fontSize: 24,
                width: 36,
                height: 36,
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
            <img
              src={fullscreenImage}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
