import type { HeadacheEntry } from '../types'

type DayPoint = {
  dateKey: string
  label: string
  intensity: number | null
  hasMedication: boolean
  hasRedFlag: boolean
}

type HeadacheChartProps = { entries: HeadacheEntry[] }
const daysBack = 30

const toDateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`

const buildPoints = (entries: HeadacheEntry[]): DayPoint[] => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: daysBack }, (_, i) => {
    const current = new Date(today)
    current.setDate(today.getDate() - (daysBack - 1 - i))
    const dateKey = toDateKey(current)
    const dayEntries = entries.filter((entry) => toDateKey(new Date(entry.startedAt)) === dateKey)
    return {
      dateKey,
      label: current.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      intensity: dayEntries.length ? Math.max(...dayEntries.map((entry) => entry.intensity)) : null,
      hasMedication: dayEntries.some((entry) => entry.medication.trim()),
      hasRedFlag: dayEntries.some((entry) => entry.intensity === 10 && entry.worstHeadache),
    }
  })
}

function HeadacheChart({ entries }: HeadacheChartProps) {
  const points = buildPoints(entries)
  if (!points.some((p) => p.intensity !== null)) {
    return <div className="chart-empty"><p className="entry-title">Пока нет данных для графика</p><p className="muted">Добавьте записи о головной боли, чтобы увидеть динамику за 30 дней.</p></div>
  }
  const width = 320, height = 188, left = 24, right = 12, top = 26, bottom = 30
  const innerWidth = width - left - right
  const innerHeight = height - top - bottom
  const path = points.map((p, i) => p.intensity === null ? null : `${left + (i / (daysBack - 1)) * innerWidth},${top + ((10 - p.intensity) / 10) * innerHeight}`).filter(Boolean).join(' ')

  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} className="headache-chart" role="img" aria-label="График интенсивности головной боли за 30 дней">
    {[0, 5, 10].map((level) => <line key={level} x1={left} y1={top + ((10 - level) / 10) * innerHeight} x2={width - right} y2={top + ((10 - level) / 10) * innerHeight} className="chart-grid" />)}
    {path && <polyline points={path} className="chart-line" />}
    {points.map((p, i) => {
      if (p.intensity === null) return null
      const x = left + (i / (daysBack - 1)) * innerWidth
      const y = top + ((10 - p.intensity) / 10) * innerHeight
      const medX = x + 8
      const medY = y + 8
      const redY = Math.max(top + 4, y - 15)
      return <g key={p.dateKey}><circle cx={x} cy={y} r={3.2} className="chart-dot" />{p.hasMedication && <circle cx={medX} cy={medY} r={2.6} className="chart-med-dot" />}{p.hasRedFlag && <circle cx={x} cy={redY} r={2.8} className="chart-red-dot" />}</g>
    })}
    {[0, 5, 10].map((level) => <text key={`label-${level}`} x={4} y={top + ((10 - level) / 10) * innerHeight + 4} className="chart-axis-label">{level}</text>)}
  </svg>
  <div className="chart-x-labels"><span>{points[0]?.label}</span><span>{points[14]?.label}</span><span>{points[29]?.label}</span></div>
  <p className="chart-helper muted">На графике показана максимальная интенсивность боли за каждый день.</p>
  <div className="chart-legend muted"><span><i className="legend-line" /> интенсивность</span><span><i className="legend-med" /> лекарство</span><span><i className="legend-red" /> красный флаг</span></div></div>
}

export default HeadacheChart
