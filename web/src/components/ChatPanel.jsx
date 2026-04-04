import { useRef, useState } from 'react'

import PlayerFace from './PlayerFace'

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
  const scrollRef = useRef(null)

  const avatarNick = profile?.nick || 'Steve'

  const streamStatus = streamState?.status || 'connecting'
  const streamLabel =
    streamStatus === 'live'         ? l.streamLive :
    streamStatus === 'reconnecting' ? l.streamReconnecting :
    streamStatus === 'error'        ? l.streamError : '…'

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      await onSend(trimmed)
      setText('')
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
              <p className="chat-text">{m.text}</p>
            </div>
          </div>
        ))}
      </div>

      {sendError && <p className="chat-send-error">{sendError}</p>}

      {/* Send form */}
      <form className="chat-form" onSubmit={handleSubmit}>
        <PlayerFace nick={avatarNick} size={30} style={{ flexShrink: 0, alignSelf: 'center' }} />
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
          disabled={!text.trim()}
        >
          {l.send}
        </button>
      </form>
    </section>
  )
}
