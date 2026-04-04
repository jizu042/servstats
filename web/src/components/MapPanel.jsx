import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom Minecraft-themed marker icon
const minecraftIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI0IiBmaWxsPSIjOGI1Y2Y2Ii8+PHBhdGggZD0iTTE2IDhMMjQgMTZMMTYgMjRMOCAxNkwxNiA4WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
})

function SkeletonLoader() {
  return (
    <div className="card fade-in" style={{ padding: '24px' }}>
      <div className="skeleton-pulse" style={{ height: '500px', borderRadius: 'var(--radius)' }} />
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="skeleton-pulse" style={{ height: '40px', borderRadius: 'var(--radius-sm)' }} />
        <div className="skeleton-pulse" style={{ height: '40px', borderRadius: 'var(--radius-sm)' }} />
        <div className="skeleton-pulse" style={{ height: '40px', borderRadius: 'var(--radius-sm)' }} />
      </div>
    </div>
  )
}

function ErrorCard({ message }) {
  return (
    <div className="card fade-in" style={{ padding: '40px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
      <h2 style={{ marginBottom: '8px', color: 'var(--text-1)' }}>Ошибка Геолокации</h2>
      <p style={{ color: 'var(--text-3)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.5 }}>
        {message}
      </p>
    </div>
  )
}

export default function MapPanel({ host, port, labels }) {
  const [geoData, setGeoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    fetch(`https://ip-api.com/json/${host}?fields=status,country,countryCode,city,lat,lon,isp,org,timezone,as`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setGeoData(data)
          setError(null)
        } else {
          setError('Геолокация недоступна для этого хоста')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Не удалось загрузить данные геолокации. Проверьте подключение к интернету.')
        setLoading(false)
      })
  }, [host])

  if (loading) return <SkeletonLoader />
  if (error) return <ErrorCard message={error} />
  if (!geoData) return null

  return (
    <div className="card map-panel fade-in">
      <div className="card-header">
        <h2 className="card-title">{labels?.title || 'Геолокация Сервера'}</h2>
      </div>

      <div className="map-container">
        <MapContainer
          center={[geoData.lat, geoData.lon]}
          zoom={6}
          style={{ height: '500px', borderRadius: 'var(--radius)', overflow: 'hidden' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <Marker position={[geoData.lat, geoData.lon]} icon={minecraftIcon}>
            <Popup>
              <div style={{ padding: '8px' }}>
                <strong style={{ fontSize: '14px', color: 'var(--purple)' }}>{host}:{port}</strong><br/>
                <span style={{ fontSize: '13px' }}>{geoData.city}, {geoData.country}</span><br/>
                <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>ISP: {geoData.isp}</span>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="geo-info-grid">
        <div className="geo-info-card">
          <div className="geo-icon">🌍</div>
          <div className="geo-content">
            <span className="geo-label">Страна</span>
            <strong className="geo-value">{geoData.country} ({geoData.countryCode})</strong>
          </div>
        </div>

        <div className="geo-info-card">
          <div className="geo-icon">🏙️</div>
          <div className="geo-content">
            <span className="geo-label">Город</span>
            <strong className="geo-value">{geoData.city}</strong>
          </div>
        </div>

        <div className="geo-info-card">
          <div className="geo-icon">📡</div>
          <div className="geo-content">
            <span className="geo-label">ISP</span>
            <strong className="geo-value">{geoData.isp}</strong>
          </div>
        </div>

        <div className="geo-info-card">
          <div className="geo-icon">🏢</div>
          <div className="geo-content">
            <span className="geo-label">Организация</span>
            <strong className="geo-value">{geoData.org || geoData.as || '—'}</strong>
          </div>
        </div>

        <div className="geo-info-card">
          <div className="geo-icon">📍</div>
          <div className="geo-content">
            <span className="geo-label">Координаты</span>
            <strong className="geo-value mono">{geoData.lat.toFixed(4)}, {geoData.lon.toFixed(4)}</strong>
          </div>
        </div>

        <div className="geo-info-card">
          <div className="geo-icon">🕐</div>
          <div className="geo-content">
            <span className="geo-label">Timezone</span>
            <strong className="geo-value">{geoData.timezone}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
