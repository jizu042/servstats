import { useEffect, useState } from 'react'
import { fetchDetails } from '../lib/api'

const SOURCES = [
  {
    key: 'direct',
    name: 'Direct TCP',
    url: 'minecraft-server-util',
    icon: '🔌',
    color: 'var(--accent)'
  },
  {
    key: 'ismcserver',
    name: 'ismcserver.online',
    url: 'api.ismcserver.online',
    icon: '📡',
    color: 'var(--purple)'
  },
  {
    key: 'mcstatus',
    name: 'mcstatus.io',
    url: 'api.mcstatus.io',
    icon: '🌐',
    color: 'var(--cyan)'
  },
  {
    key: 'mcsrvstat',
    name: 'mcsrvstat.us',
    url: 'api.mcsrvstat.us',
    icon: '📋',
    color: 'var(--yellow)'
  }
]

function SourceCard({ source, data, loading, error }) {
  const { name, url, icon, color } = source

  return (
    <div className="detail-source-card">
      <div className="detail-source-header">
        <div className="detail-source-icon" style={{ background: `${color}20`, borderColor: `${color}40`, color }}>
          {icon}
        </div>
        <div>
          <div className="detail-source-name">{name}</div>
          <div className="detail-source-url">{url}</div>
        </div>
        {data && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              padding: '3px 9px',
              borderRadius: 999,
              background: data.online ? 'var(--accent-dim)' : 'var(--red-dim)',
              border: `1px solid ${data.online ? 'var(--accent-ring)' : 'rgba(248,113,113,0.3)'}`,
              color: data.online ? 'var(--accent)' : 'var(--red)',
              fontWeight: 600,
              flexShrink: 0
            }}
          >
            {data.online ? 'Online' : 'Offline'}
          </span>
        )}
      </div>

      {loading && (
        <div className="detail-loading">
          <span className="spinner" /> Загрузка…
        </div>
      )}

      {error && !loading && (
        <div className="detail-error">⚠️ {error}</div>
      )}

      {data && !loading && (
        <div className="detail-rows">
          {data.ping !== undefined && data.ping !== null && (
            <div className="detail-row">
              <span className="detail-row-label">Пинг</span>
              <span className="detail-row-val" style={{ color: data.ping < 80 ? 'var(--accent)' : data.ping < 150 ? 'var(--yellow)' : 'var(--red)' }}>
                {data.ping} ms
              </span>
            </div>
          )}
          {data.players !== undefined && (
            <div className="detail-row">
              <span className="detail-row-label">Игроки</span>
              <span className="detail-row-val">{data.players?.online ?? 0} / {data.players?.max ?? 0}</span>
            </div>
          )}
          {data.version && (
            <div className="detail-row">
              <span className="detail-row-label">Версия</span>
              <span className="detail-row-val" style={{ fontSize: 12, color: 'var(--text-2)' }}>{data.version}</span>
            </div>
          )}
          {data.software && (
            <div className="detail-row">
              <span className="detail-row-label">Тип</span>
              <span className="detail-row-val">{data.software}</span>
            </div>
          )}
          {data.motd?.clean && (
            <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <span className="detail-row-label">MOTD</span>
              <span style={{ fontSize: 12, color: 'var(--text-2)', wordBreak: 'break-word' }}>{data.motd.clean}</span>
            </div>
          )}
          {data.favicon && (
            <div className="detail-row">
              <span className="detail-row-label">Иконка</span>
              <img src={data.favicon} alt="" style={{ width: 32, height: 32, borderRadius: 6, imageRendering: 'pixelated' }} />
            </div>
          )}
          {data.tags && data.tags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <span className="detail-row-label" style={{ display: 'block', marginBottom: 6 }}>Теги</span>
              <div className="details-tags">
                {data.tags.map((tag) => (
                  <span key={tag} className="detail-tag">{tag}</span>
                ))}
              </div>
            </div>
          )}
          {data.description && (
            <div style={{ marginTop: 8 }}>
              <span className="detail-row-label" style={{ display: 'block', marginBottom: 4 }}>Описание</span>
              <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>{data.description}</p>
            </div>
          )}
          {data.votes !== undefined && (
            <div className="detail-row">
              <span className="detail-row-label">Голоса</span>
              <span className="detail-row-val" style={{ color: 'var(--yellow)' }}>⭐ {data.votes}</span>
            </div>
          )}
          {data.rating !== undefined && data.rating !== null && (
            <div className="detail-row">
              <span className="detail-row-label">Рейтинг</span>
              <span className="detail-row-val">{data.rating}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DetailsPanel({ apiBase, host, port, labels }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetchDetails(apiBase, host, port)
      .then((d) => { setData(d); setLastUpdated(Date.now()) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [apiBase, host, port])

  return (
    <section className="fade-in">
      <div className="card-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="card-title">Подробности</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-3)' }}>
            Агрегированные данные из внешних источников
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              Обновлено: {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            style={{ padding: '7px 14px', fontSize: 12.5 }}
          >
            {loading ? <><span className="spinner" style={{ width: 12, height: 12 }} /></> : '🔄 Обновить'}
          </button>
        </div>
      </div>

      {error && (
        <div className="detail-error" style={{ marginBottom: 14, padding: '10px 14px' }}>
          ⚠️ Ошибка загрузки: {error}
        </div>
      )}

      <div className="details-grid">
        {SOURCES.map((source) => (
          <SourceCard
            key={source.key}
            source={source}
            data={data?.[source.key]}
            loading={loading}
            error={!loading && !data?.[source.key] ? 'Нет данных' : null}
          />
        ))}
      </div>

      {/* Server info summary */}
      {data && !loading && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h3 className="card-title">Сводка</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {[data.direct, data.ismcserver, data.mcstatus, data.mcsrvstat].filter(Boolean).map((s, i) => (
              s.online && s.ping !== null && s.ping !== undefined
                ? <div key={i} className="metric-box">
                    <span className="metric-label">{s.source || `Источник ${i + 1}`}</span>
                    <div className="metric-value" style={{ fontSize: '1.1rem', color: s.ping < 100 ? 'var(--accent)' : 'var(--yellow)' }}>
                      {s.ping} ms
                    </div>
                    <div className="metric-sub">пинг</div>
                  </div>
                : null
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
