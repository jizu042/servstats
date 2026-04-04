import { useMemo, useState } from 'react'

export default function ChatPanel({ profile, messages, onSend, onLogin, onLogout, authEnabled, labels, authError, onNickClick, chatLoading, chatError, sending, sseState, canSend }) {
  const l = labels || {
    title: 'Chat',
    subtitle: 'Global realtime chat',
    signedInAs: 'Signed in as',
    logout: 'Logout',
    oauthNotConfigured: 'OAuth not configured. Demo mode enabled.',
    signInPrompt: 'Sign in via ely.by to link your nickname',
    loginEly: 'Login via ely.by',
    messagePlaceholder: 'Message...',
    send: 'Send',
    empty: 'No messages yet',
    authNotReady: 'ely.by OAuth is not configured on the backend yet',
    loadError: 'Failed to load chat history',
    sendError: 'Failed to send message',
    reconnecting: 'Reconnecting realtime…'
  }
  const [text, setText] = useState('')
  const avatar = useMemo(() => profile?.nick ? `https://craft.ely.by/api/player/head/${encodeURIComponent(profile.nick)}` : '', [profile])

  return (
    <section className="card chat-card">
      <div className="chat-head">
        <div>
          <h3>{l.title}</h3>
          <p className="muted chat-subtitle">{l.subtitle}</p>
        </div>
      </div>
      {profile?.nick && (
        <div className="chat-auth-row">
          <div className="muted chat-profile-inline">
            <img src={`https://craft.ely.by/api/player/head/${encodeURIComponent(profile.nick)}`} alt={profile.nick} />
            <span>{l.signedInAs} <b>{profile.nick}</b></span>
          </div>
          {onLogout && <button onClick={onLogout}>{l.logout}</button>}
        </div>
      )}
      {!profile?.nick && (
        <div>
          <p className="muted">{authEnabled ? l.signInPrompt : l.oauthNotConfigured}</p>
          {onLogin && <button onClick={onLogin} disabled={!authEnabled}>{l.loginEly}</button>}
          {(authError || !authEnabled) && <p className="warn-text">{authError || l.authNotReady}</p>}
        </div>
      )}
      <div className="chat-list">
        {chatLoading && <p className="muted">Loading…</p>}
        {chatError && <p className="warn-text">{chatError}</p>}
        {sseState === 'reconnecting' && <p className="muted mono">{l.reconnecting}</p>}
        {messages.length === 0 && <p className="muted">{l.empty}</p>}
        {messages.map((m, i) => (
          <div className="chat-item" key={i}>
            <img src={`https://craft.ely.by/api/player/head/${encodeURIComponent(m.nick)}`} alt={m.nick} />
            <div>
              <button type="button" className="chat-nick-btn" onClick={() => onNickClick?.(m.nick)}>
                <span>{m.nick}</span>
              </button>
              <p className="chat-text">{m.text}</p>
              <small className="muted mono">{m.ts ? new Date(m.ts).toLocaleTimeString() : ''}</small>
            </div>
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; onSend(text); setText('') }}>
        <img src={avatar || 'https://craft.ely.by/api/player/head/Steve'} alt="me" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={l.messagePlaceholder} disabled={!canSend || sending} />
        <button type="submit" disabled={!canSend || sending}>{sending ? '…' : l.send}</button>
      </form>
    </section>
  )
}
