import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

function formatDuration(ms) {
  if (!ms || ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}ч ${m}м`
  return `${m}м`
}

import PlayerFace from './PlayerFace'

export default function StatsPanel({ stats, playersList, labels, loading, onPlayerClick }) {
  const l      = labels || {}
  const points = stats.history24h || []
  const isWeek = stats.rangeHours > 24

  const fmt = isWeek
    ? (t) => new Date(t).toLocaleDateString([], { day: '2-digit', month: '2-digit' })
    : (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const data = {
    labels: points.map((p) => fmt(p.t)),
    datasets: [{
      label: l.onlinePlayers,
      data: points.map((p) => p.v),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: points.length > 120 ? 0 : 2,
      pointBackgroundColor: '#8b5cf6',
      pointHitRadius: 8,
      borderWidth: 2
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: isWeek ? 8 : 12,
          color: '#5c6082',
          maxRotation: 0,
          font: { size: 11, family: 'Inter' }
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { color: 'rgba(255,255,255,0.06)' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#5c6082', font: { size: 11, family: 'Inter' } },
        grid: { color: 'rgba(255,255,255,0.04)' },
        border: { color: 'rgba(255,255,255,0.06)' }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,17,32,0.95)',
        borderColor: 'rgba(139,92,246,0.4)',
        borderWidth: 1,
        titleColor: '#8b5cf6',
        bodyColor: '#f1f2f8',
        padding: 10,
        cornerRadius: 8
      }
    }
  }

  // Aggregate playersList by nick (sum durations, count visits)
  const playerAgg = {}
  for (const p of (playersList || [])) {
    if (!p.nick) continue
    if (!playerAgg[p.nick]) playerAgg[p.nick] = { nick: p.nick, visits: 0, totalMs: 0, lastSeen: 0 }
    const dur = p.end ? (p.end - p.start) : (Date.now() - p.start)
    playerAgg[p.nick].visits    += 1
    playerAgg[p.nick].totalMs  += dur
    playerAgg[p.nick].lastSeen  = Math.max(playerAgg[p.nick].lastSeen, p.end || p.start)
  }
  const aggPlayers = Object.values(playerAgg).sort((a, b) => b.totalMs - a.totalMs)

  return (
    <section className="card stats-card fade-in">
      <div className="card-header">
        <h2 className="card-title">{l.title}</h2>
        <div className="stats-controls">
          <button
            type="button"
            className={`range-btn${stats.rangeHours === 24 ? ' active' : ''}`}
            onClick={() => stats.setRangeHours?.(24)}
          >24ч</button>
          <button
            type="button"
            className={`range-btn${stats.rangeHours === 168 ? ' active' : ''}`}
            onClick={() => stats.setRangeHours?.(168)}
          >7д</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="stats-summary">
        <div className="metric-box">
          <span className="metric-label">{l.peak}</span>
          <div className="metric-value" style={{ color: 'var(--purple)' }}>{stats.peak ?? 0}</div>
          <div className="metric-sub">игроков</div>
        </div>
        <div className="metric-box">
          <span className="metric-label">{l.offlines}</span>
          <div className="metric-value" style={{ color: 'var(--red)' }}>{stats.offlines ?? 0}</div>
          <div className="metric-sub">за период</div>
        </div>
        <div className="metric-box">
          <span className="metric-label">{l.avgUptime}</span>
          <div className="metric-value" style={{ color: 'var(--cyan)', fontSize: '1.05rem' }}>
            {stats.avgUptime ?? '—'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-wrap">
        {loading && (
          <div className="chart-placeholder chart-loading">
            <span className="spinner" />
          </div>
        )}
        {!loading && points.length === 0 && (
          <div className="chart-placeholder">
            <span style={{ fontSize: 28 }}>📊</span>
            <span>{l.empty}</span>
          </div>
        )}
        {!loading && points.length > 0 && <Line data={data} options={options} />}
      </div>

      {/* Player history table */}
      {aggPlayers.length > 0 && (
        <div className="players-history-section">
          <h3>{l.playersHistory || 'История игроков'}</h3>
          <div className="phi-table">
            {aggPlayers.slice(0, 30).map((p) => (
              <div
                key={p.nick}
                className="phi-row"
                role="button"
                tabIndex={0}
                onClick={() => onPlayerClick?.(p.nick)}
                onKeyDown={(e) => e.key === 'Enter' && onPlayerClick?.(p.nick)}
              >
                <PlayerFace
                  nick={p.nick}
                  size={26}
                  style={{ marginRight: 10 }}
                />
                <span className="phi-nick">{p.nick}</span>
                <span className="phi-time muted2">
                  {p.visits} {p.visits === 1 ? 'визит' : 'визитов'}
                </span>
                <span className="phi-duration">{formatDuration(p.totalMs)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {aggPlayers.length === 0 && !loading && (
        <div className="players-history-section">
          <h3>{l.playersHistory || 'История игроков'}</h3>
          <div className="no-data-placeholder" style={{ padding: '20px' }}>
            <span className="no-data-icon">👥</span>
            <span className="muted2">{l.empty}</span>
          </div>
        </div>
      )}
    </section>
  )
}
