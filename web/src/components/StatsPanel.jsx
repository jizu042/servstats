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

export default function StatsPanel({ stats, labels, loading }) {
  const l = labels || {}
  const points = stats.history24h || []
  const isWeek = stats.rangeHours > 24
  const fmt = isWeek
    ? (t) => new Date(t).toLocaleDateString([], { day: '2-digit', month: '2-digit' })
    : (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const maxTicks = isWeek ? 8 : 12

  const data = {
    labels: points.map((p) => fmt(p.t)),
    datasets: [
      {
        label: l.onlinePlayers,
        data: points.map((p) => p.v),
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.12)',
        fill: true,
        tension: 0.2,
        pointRadius: points.length > 120 ? 0 : 2,
        pointHitRadius: 6
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { maxTicksLimit: maxTicks, color: '#9ca3af', maxRotation: 0 },
        grid: { color: 'rgba(255,255,255,0.06)' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(255,255,255,0.06)' }
      }
    },
    plugins: {
      legend: { labels: { color: '#e5e7eb' } }
    }
  }

  return (
    <section className="card stats-card">
      <h3>{l.title}</h3>
      <div className="tabs stats-tabs">
        <button type="button" className={stats.rangeHours === 24 ? 'active' : ''} onClick={() => stats.setRangeHours?.(24)}>
          24h
        </button>
        <button type="button" className={stats.rangeHours === 168 ? 'active' : ''} onClick={() => stats.setRangeHours?.(168)}>
          7d
        </button>
      </div>
      <div className="metrics">
        <div>
          <span className="label">{l.peak}</span>
          <strong className="tabular-nums">{stats.peak ?? 0}</strong>
        </div>
        <div>
          <span className="label">{l.offlines}</span>
          <strong className="tabular-nums">{stats.offlines ?? 0}</strong>
        </div>
        <div>
          <span className="label">{l.avgUptime}</span>
          <strong className="tabular-nums">{stats.avgUptime ?? '—'}</strong>
        </div>
      </div>
      <div className="chart-wrap">
        {loading && (
          <div className="chart-placeholder chart-loading">
            <span>{l.loading}</span>
          </div>
        )}
        {!loading && points.length === 0 && (
          <div className="chart-placeholder chart-empty">
            <span>{l.empty}</span>
          </div>
        )}
        {!loading && points.length > 0 && <Line data={data} options={options} />}
      </div>
    </section>
  )
}
