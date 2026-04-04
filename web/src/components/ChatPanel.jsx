import { useMemo, useState } from 'react'

function headUrl(nick) {
  return `https://craft.ely.by/api/player/head/${encodeURIComponent(nick)}`
}

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
  onRetryLoad
}) {
  const l = labels || {}
  const [text, setText] = useState('')
  const avatar = useMemo(
    () => (profile?.nick ? headUrl(profile.nick) : ''),
    [profile?.nick]
  )

  const streamLabel =
    streamState?.status === 'live'
      ? l.streamLive
      : streamState?.status === 'reconnecting'
        ? l.streamReconnecting
        : streamState?.status === 'error'
          ? l.streamError
          : '…'

  return (
    <section className="card chat-card">
      <div className="chat-card-header">
        <h3>{l.title}</h3>
        <span className={`stream-pill stream-${streamState?.status || 'connecting'}`}>{streamLabel}</span>
      </div>

      {profile?.nick && (
        <div className="chat-profile-row">
          <div className="chat-profile-ident">
            {avatar ? <img src={avatar} alt="" className="chat-profile-avatar" width={28} height={28} /> : null}
            <span className="muted">
              {l.signedInAs} <b>{profile.nick}</b>
            </span>
          </div>
          {onLogout && (
            <button type="button" onClick={onLogout}>
              {l.logout}
            </button>
          )}
        </div>
      )}

      {!profile?.nick && (
        <div className="chat-guest-block">
          <p className="muted">{authEnabled ? l.signInPrompt : l.oauthNotConfigured}</p>
          {onLogin && authEnabled && (
            <button type="button" onClick={onLogin}>
              {l.loginEly}
            </button>
          )}
        </div>
      )}

      {loadState === 'loading' && <p className="muted chat-meta">{l.loadingHistory}</p>}
      {loadState === 'error' && (
        <div className="chat-error-banner">
          <span>{l.loadHistoryError}</span>
          <button type="button" onClick={onRetryLoad}>
            {l.retry}
          </button>
        </div>
      )}

      <div className="chat-scroll">
        {loadState === 'ready' && messages.length === 0 && <p className="muted chat-meta">{l.emptyChat}</p>}
        {messages.map((m, i) => (
          <div className="chat-item" key={`${m.ts}-${i}-${m.nick}`}>
            <img src={headUrl(m.nick)} alt="" width={24} height={24} />
            <div className="chat-item-body">
              <div className="chat-item-head">
                <b className="chat-nick">{m.nick}</b>
                <small className="muted mono">{m.ts ? new Date(m.ts).toLocaleTimeString() : ''}</small>
              </div>
              <p className="chat-text">{m.text}</p>
            </div>
          </div>
        ))}
      </div>

      {sendError && <p className="chat-send-error">{sendError}</p>}

      <form
        className="chat-form"
        onSubmit={async (e) => {
          e.preventDefault()
          const trimmed = text.trim()
          if (!trimmed) return
          try {
            await onSend(trimmed)
            setText('')
          } catch {
            /* error surfaced via sendError */
          }
        }}
      >
        <img src={avatar || headUrl('Steve')} alt="" width={28} height={28} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={l.messagePlaceholder} />
        <button type="submit">{l.send}</button>
      </form>
    </section>
  )
}
