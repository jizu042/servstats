import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export default function StatsPanel({ stats, labels }) {
  const l = labels || {
    title: 'Statistics',
    onlinePlayers: 'Online players',
    peak: 'Peak online',
    offlines: 'Crashes/offlines',
    avgUptime: 'Avg uptime'
  }
  const points = stats.history24h || []
  const fmt = stats.rangeHours > 24
    ? (t) => new Date(t).toLocaleDateString([], { day: '2-digit', month: '2-digit' })
    : (t) => new Date(t).toLocaleTimeString()
  const data = {
    labels: points.map((p) => fmt(p.t)),
    datasets: [
      {
        label: l.onlinePlayers,
        data: points.map((p) => p.v),
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
        tension: 0.2
      }
    ]
  }

  return (
    <section className="card">
      <h3>{l.title}</h3>
      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={stats.rangeHours === 24 ? 'active' : ''} onClick={() => stats.setRangeHours?.(24)}>24h</button>
        <button className={stats.rangeHours === 168 ? 'active' : ''} onClick={() => stats.setRangeHours?.(168)}>7d</button>
      </div>
      <div className="metrics">
        <div><span className="label">{l.peak}</span><strong>{stats.peak ?? 0}</strong></div>
        <div><span className="label">{l.offlines}</span><strong>{stats.offlines ?? 0}</strong></div>
        <div><span className="label">{l.avgUptime}</span><strong>{stats.avgUptime ?? '—'}</strong></div>
      </div>
      <Line data={data} />
    </section>
  )
}
