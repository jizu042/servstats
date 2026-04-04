export default function SettingsPanel({ settings, onChange, onAskNotifications, labels, onClose }) {
  const l = labels || {
    title: 'Settings',
    serverAddress: 'Server address',
    pollInterval: 'Poll interval',
    apiSource: 'API source',
    notifyOnline: 'Online notifications',
    darkTheme: 'Dark theme',
    language: 'Language',
    requestNotifications: 'Request notifications'
  }
  return (
    <section className="settings-pane">
      <div className="settings-head">
        <h3>{l.title}</h3>
        {onClose && <button onClick={onClose}>✕</button>}
      </div>
      <label>
        {l.serverAddress}
        <input value={settings.hostPort} onChange={(e) => onChange({ hostPort: e.target.value })} placeholder="host:port" />
      </label>
      <label>
        {l.pollInterval}
        <select value={settings.pollSec} onChange={(e) => onChange({ pollSec: Number(e.target.value) })}>
          <option value={5}>5 sec</option>
          <option value={10}>10 sec</option>
          <option value={30}>30 sec</option>
        </select>
      </label>
      <label>
        {l.apiSource}
        <select value={settings.apiSource} onChange={(e) => onChange({ apiSource: e.target.value })}>
          <option value="auto">Auto</option>
          <option value="ismcserver">ismcserver</option>
          <option value="mcstatus">mcstatus</option>
        </select>
      </label>
      <label className="toggle-row">
        <span>{l.notifyOnline}</span>
        <input type="checkbox" checked={settings.notifyOnOnline} onChange={(e) => onChange({ notifyOnOnline: e.target.checked })} />
      </label>
      <label className="toggle-row">
        <span>{l.darkTheme}</span>
        <input type="checkbox" checked={settings.theme === 'dark'} onChange={(e) => onChange({ theme: e.target.checked ? 'dark' : 'light' })} />
      </label>
      <label>
        {l.language}
        <select value={settings.lang} onChange={(e) => onChange({ lang: e.target.value })}>
          <option value="ru">RU</option>
          <option value="en">EN</option>
        </select>
      </label>
      <button onClick={onAskNotifications}>{l.requestNotifications}</button>
    </section>
  )
}
