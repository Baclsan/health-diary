import type { HeadacheEntry } from '../types'

type DayPoint = {
  dateKey: string
  label: string
  intensity: number
  hasMedication: boolean
  hasRedFlag: boolean
}

type HeadacheChartProps = {
  entries: HeadacheEntry[]
}

const toDateKey = (date: Date) => date.toISOString().slice(0, 10)

const buildLast30Days = (): DayPoint[] => {
  const days: DayPoint[] = []
  const now = new Date()

  for (let i = 29; i >= 0; i -= 1) {
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - i)
    days.push({
      dateKey: toDateKey(day),
      label: day.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      intensity: 0,
      hasMedication: false,
      hasRedFlag: false,
    })
  }

  return days
}

export function HeadacheChart({ entries }: HeadacheChartProps) {
  const days = buildLast30Days()
  const map = new Map(days.map((day) => [day.dateKey, { ...day }]))

  entries.forEach((entry) => {
    const started = new Date(entry.startedAt)
    const key = toDateKey(started)
    const day = map.get(key)
    if (!day) return

    day.intensity = Math.max(day.intensity, entry.intensity)
    day.hasMedication = day.hasMedication || Boolean(entry.medication.trim())
    day.hasRedFlag = day.hasRedFlag || (entry.intensity === 10 && entry.worstHeadache)
  })

  const data = days.map((day) => map.get(day.dateKey) ?? day)
  const hasAnyData = data.some((day) => day.intensity > 0)

  if (!hasAnyData) {
    return <p className="chart-empty">Пока недостаточно данных для графика. Добавьте первую запись.</p>
  }

  const width = 320
  const height = 170
  const chartTop = 20
  const chartBottom = 138
  const chartLeft = 10
  const chartRight = width - 10

  const xStep = (chartRight - chartLeft) / (data.length - 1)
  const toY = (value: number) => chartBottom - (value / 10) * (chartBottom - chartTop)

  const points = data.map((day, index) => ({ x: chartLeft + index * xStep, y: toY(day.intensity), ...day }))

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Динамика боли">
        {[0, 2, 4, 6, 8, 10].map((tick) => {
          const y = toY(tick)
          return (
            <g key={tick}>
              <line x1={chartLeft} y1={y} x2={chartRight} y2={y} className="chart-grid" />
              <text x={0} y={y + 3} className="chart-axis-text">
                {tick}
              </text>
            </g>
          )
        })}

        <path d={linePath} className="chart-line" />

        {points.map((point, index) => (
          <g key={point.dateKey}>
            <circle cx={point.x} cy={point.y} r={2.9} className="chart-point" />
            {point.hasMedication && <circle cx={point.x - 3} cy={point.y - 11} r={2.3} className="chart-med" />}
            {point.hasRedFlag && <circle cx={point.x + 3} cy={point.y - 11} r={2.3} className="chart-red" />}
            {index % 5 === 0 && (
              <text x={point.x} y={152} textAnchor="middle" className="chart-axis-text">
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="chart-legend">
        <span>
          <i className="legend-dot line" /> линия/точка = интенсивность боли
        </span>
        <span>
          <i className="legend-dot med" /> жёлтая точка = принято лекарство
        </span>
        <span>
          <i className="legend-dot red" /> красная точка = красный флаг
        </span>
      </div>
    </div>
  )
}
