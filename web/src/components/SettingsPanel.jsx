export default function SettingsPanel({ settings, onChange, onAskNotifications, labels, me, authEnabled, onLogin, onLogout }) {
  const l = labels || {}
  return (
    <div style={{ display: 'grid', gap: 0 }}>
      {/* Account */}
      <div className="settings-section">
        <div className="settings-section-title">Аккаунт</div>
        {me?.nick ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
            {me.avatar && (
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid var(--purple-ring)',
                overflow: 'hidden',
                background: 'var(--bg-3)',
                flexShrink: 0
              }}>
                <img
                  src={me.avatar}
                  alt=""
                  style={{
                    width: 288,
                    height: 288,
                    marginLeft: -72,
                    marginTop: -72,
                    imageRendering: 'pixelated',
                    display: 'block',
                    transform: 'scale(0.125)',
                    transformOrigin: 'top left'
                  }}
                />
              </div>
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>@{me.nick}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Ely.by аккаунт</div>
            </div>
            <button type="button" className="btn-danger" style={{ marginLeft: 'auto', padding: '5px 11px', fontSize: 12 }} onClick={onLogout}>
              {l.logout || 'Выйти'}
            </button>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {authEnabled ? (
              <button type="button" className="btn-primary" style={{ width: '100%' }} onClick={onLogin}>
                Войти через Ely.by
              </button>
            ) : (
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>
                OAuth не настроен на сервере.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Server */}
      <div className="settings-section">
        <div className="settings-section-title">Сервер</div>
        <div className="settings-form">
          <label className="settings-label">
            {l.serverAddress}
            <input
              value={settings.hostPort}
              onChange={(e) => onChange({ hostPort: e.target.value })}
              placeholder="host:port"
            />
          </label>
          <label className="settings-label">
            {l.pollInterval}
            <select value={settings.pollSec} onChange={(e) => onChange({ pollSec: Number(e.target.value) })}>
              <option value={5}>5 сек</option>
              <option value={10}>10 сек</option>
              <option value={30}>30 сек</option>
              <option value={60}>1 мин</option>
            </select>
          </label>
          <label className="settings-label">
            {l.apiSource}
            <select value={settings.apiSource} onChange={(e) => onChange({ apiSource: e.target.value })}>
              <option value="auto">Auto</option>
              <option value="direct">Direct (прямой)</option>
              <option value="ismcserver">ismcserver.online</option>
              <option value="mcstatus">mcstatus.io</option>
            </select>
          </label>
        </div>
      </div>

      {/* Appearance */}
      <div className="settings-section">
        <div className="settings-section-title">Внешний вид</div>
        <div className="settings-form">
          <label className="settings-label toggle-row">
            <span>{l.darkTheme}</span>
            <input
              type="checkbox"
              checked={settings.theme === 'dark'}
              onChange={(e) => onChange({ theme: e.target.checked ? 'dark' : 'light' })}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--purple)' }}
            />
          </label>
          <label className="settings-label">
            {l.language}
            <select value={settings.lang} onChange={(e) => onChange({ lang: e.target.value })}>
              <option value="ru">🇷🇺 Русский</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </label>
        </div>
      </div>

      {/* Notifications */}
      <div className="settings-section">
        <div className="settings-section-title">Уведомления</div>
        <div className="settings-form">
          <label className="settings-label toggle-row">
            <span>{l.notifyOnline}</span>
            <input
              type="checkbox"
              checked={settings.notifyOnOnline}
              onChange={(e) => onChange({ notifyOnOnline: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--purple)' }}
            />
          </label>
          <button
            type="button"
            style={{ width: '100%', marginTop: 4 }}
            onClick={onAskNotifications}
          >
            {l.requestNotifications}
          </button>
        </div>
      </div>
    </div>
  )
}
