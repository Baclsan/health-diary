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
  const getX = (index: number) => left + (index / (daysBack - 1)) * innerWidth
  const getY = (intensity: number) => top + ((10 - intensity) / 10) * innerHeight
  const linePoints = points
    .map((point, i) => (point.intensity === null ? null : [getX(i), getY(point.intensity)] as const))
    .filter((point): point is readonly [number, number] => Boolean(point))

  const path = linePoints.map(([x, y]) => `${x},${y}`).join(' ')

  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} className="headache-chart" role="img" aria-label="График интенсивности головной боли за 30 дней">
    {[0, 5, 10].map((level) => <line key={level} x1={left} y1={top + ((10 - level) / 10) * innerHeight} x2={width - right} y2={top + ((10 - level) / 10) * innerHeight} className="chart-grid" />)}
    <defs><filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.8" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
    {path && <polyline points={path} className="chart-line-glow" />}
    {path && <polyline points={path} className="chart-line" />}
    {points.map((p, i) => {
      if (p.intensity === null) return null
      const x = getX(i)
      const y = getY(p.intensity)
      const medY = Math.min(top + innerHeight - 4, y + 12)
      const medX = p.hasRedFlag ? x - 4 : x
      const redY = Math.max(top + 5, y - 12)
      const redX = p.hasMedication ? x + 4 : x
      return <g key={p.dateKey}><circle cx={x} cy={y} r={3.5} className="chart-dot-glow" /><circle cx={x} cy={y} r={3.2} className="chart-dot" />{p.hasMedication && <circle cx={medX} cy={medY} r={2.8} className="chart-med-dot" />}{p.hasRedFlag && <circle cx={redX} cy={redY} r={2.9} className="chart-red-dot" />}</g>
    })}
    {[0, 5, 10].map((level) => <text key={`label-${level}`} x={4} y={top + ((10 - level) / 10) * innerHeight + 4} className="chart-axis-label">{level}</text>)}
  </svg>
  <div className="chart-x-labels"><span>{points[0]?.label}</span><span>{points[14]?.label}</span><span>{points[29]?.label}</span></div>
  <p className="chart-helper muted">На графике показана максимальная интенсивность боли за каждый день.</p>
  <div className="chart-legend muted"><span><i className="legend-line" /> интенсивность</span><span><i className="legend-med" /> лекарство</span><span><i className="legend-red" /> красный флаг</span></div></div>
}

export default HeadacheChart
