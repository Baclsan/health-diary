import { useMemo, useState } from 'react'
import './App.css'
import { loadEntries, saveEntries } from './storage'
import type { HeadacheEntry } from './types'

type Screen = 'home' | 'add' | 'history'

type FormState = {
  startedAt: string
  intensity: number
  durationMinutes: number
  location: string
  painType: string
  symptoms: string[]
  symptomsCustom: string
  medication: string
  triggers: string[]
  triggersCustom: string
  comment: string
  worstHeadache: boolean
}

const durationPresets = [
  { label: '<30 мин', value: 20 },
  { label: '1 час', value: 60 },
  { label: '2–4 часа', value: 180 },
  { label: 'Весь день', value: 1440 },
]

const locationPresets = ['Лоб', 'Виски', 'Затылок', 'Одна сторона', 'Вся голова', 'Шея']
const painTypePresets = ['Пульсирующая', 'Сдавливающая', 'Острая', 'Ноющая', 'Жгучая']
const symptomPresets = ['Тошнота', 'Светобоязнь', 'Звукобоязнь', 'Аура', 'Головокружение', 'Слабость']
const triggerPresets = ['Стресс', 'Недосып', 'Погода', 'Пропуск еды', 'Алкоголь', 'Менструация']

const emptyForm = (): FormState => ({
  startedAt: new Date().toISOString().slice(0, 16),
  intensity: 5,
  durationMinutes: 60,
  location: 'Виски',
  painType: 'Пульсирующая',
  symptoms: [],
  symptomsCustom: '',
  medication: '',
  triggers: [],
  triggersCustom: '',
  comment: '',
  worstHeadache: false,
})

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} мин`
  if (minutes === 60) return '1 ч'
  if (minutes >= 1440) return 'Весь день'

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60

  if (restMinutes === 0) return `${hours} ч`
  return `${hours} ч ${restMinutes} мин`
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [entries, setEntries] = useState<HeadacheEntry[]>(() => loadEntries())
  const [form, setForm] = useState<FormState>(() => emptyForm())

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)),
    [entries],
  )

  const latestEntries = sortedEntries.slice(0, 3)

  const stats30 = useMemo(() => {
    const now = Date.now()

    const in30Days = sortedEntries.filter((entry) => {
      const diff = now - +new Date(entry.startedAt)
      return diff <= 30 * 24 * 60 * 60 * 1000
    })

    const entriesCount = in30Days.length
    const avgIntensity = entriesCount
      ? (in30Days.reduce((acc, entry) => acc + entry.intensity, 0) / entriesCount).toFixed(1)
      : '0'

    const medicationDays = new Set(
      in30Days
        .filter((entry) => entry.medication.trim())
        .map((entry) => new Date(entry.startedAt).toISOString().slice(0, 10)),
    ).size

    const redFlags = in30Days.filter((entry) => entry.intensity === 10 && entry.worstHeadache).length

    return { entriesCount, avgIntensity, medicationDays, redFlags }
  }, [sortedEntries])

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleMulti = (field: 'symptoms' | 'triggers', value: string) => {
    setForm((prev) => {
      const selected = prev[field]
      const next = selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
      return { ...prev, [field]: next }
    })
  }

  const saveEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const symptoms = [...form.symptoms, form.symptomsCustom.trim()].filter(Boolean).join(', ')
    const triggers = [...form.triggers, form.triggersCustom.trim()].filter(Boolean).join(', ')

    const nextEntry: HeadacheEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      startedAt: form.startedAt,
      intensity: form.intensity,
      durationMinutes: form.durationMinutes,
      location: form.location.trim(),
      painType: form.painType.trim(),
      symptoms,
      medication: form.medication.trim(),
      triggers,
      comment: form.comment.trim(),
      worstHeadache: form.intensity === 10 ? form.worstHeadache : false,
    }

    const next = [nextEntry, ...entries]
    setEntries(next)
    saveEntries(next)
    setForm(emptyForm())
    setScreen('home')
  }

  const deleteEntry = (id: string) => {
    const next = entries.filter((entry) => entry.id !== id)
    setEntries(next)
    saveEntries(next)
  }

  return (
    <div className="app-shell">
      <main className="phone-frame">
        {screen === 'home' && (
          <section className="fade-in screen-content">
            <header>
              <h1>Дневник здоровья</h1>
              <p className="subtitle">Спокойно фиксируйте важные симптомы</p>
            </header>

            <article className="card hero">
              <h2>Мягкий ритм наблюдений</h2>
              <p>
                Записывайте эпизоды в несколько касаний и отслеживайте важные детали для следующей
                консультации.
              </p>
              <button className="primary-btn" onClick={() => setScreen('add')}>
                + Добавить головную боль
              </button>
            </article>

            <article className="card">
              <h3>Статистика за 30 дней</h3>
              <div className="stats-grid four-cols">
                <div>
                  <strong>{stats30.entriesCount}</strong>
                  <span>записей за 30 дней</span>
                </div>
                <div>
                  <strong>{stats30.avgIntensity}</strong>
                  <span>средняя интенсивность</span>
                </div>
                <div>
                  <strong>{stats30.medicationDays}</strong>
                  <span>дней с лекарствами</span>
                </div>
                <div>
                  <strong>{stats30.redFlags}</strong>
                  <span>красных флагов</span>
                </div>
              </div>
            </article>

            <article className="card">
              <div className="section-row">
                <h3>Последние записи</h3>
                <button className="link-btn" onClick={() => setScreen('history')}>
                  Вся история
                </button>
              </div>

              {latestEntries.length === 0 ? (
                <div className="empty-state">
                  <p className="entry-title">Пока записей нет</p>
                  <p className="muted">Сделайте первую запись, чтобы видеть динамику симптомов.</p>
                  <button className="soft-btn" onClick={() => setScreen('add')}>
                    Добавить первую запись
                  </button>
                </div>
              ) : (
                <ul className="entry-list compact">
                  {latestEntries.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <p className="entry-title">{formatDate(entry.startedAt)}</p>
                        <p className="muted">
                          {entry.intensity}/10 · {formatDuration(entry.durationMinutes)}
                        </p>
                      </div>
                      <span className="badge">{entry.location}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        )}

        {screen === 'add' && (
          <section className="fade-in screen-content">
            <div className="section-row">
              <h2>Новая запись</h2>
              <button className="link-btn" onClick={() => setScreen('home')}>
                Назад
              </button>
            </div>

            <form className="form" onSubmit={saveEntry}>
              <article className="card">
                <h3>Главное</h3>
                <label>
                  Начало эпизода
                  <input
                    type="datetime-local"
                    value={form.startedAt}
                    onChange={(e) => updateForm('startedAt', e.target.value)}
                    required
                  />
                </label>

                <label>
                  Интенсивность: {form.intensity}/10
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={form.intensity}
                    onChange={(e) => updateForm('intensity', Number(e.target.value))}
                  />
                </label>

                <label>
                  Длительность
                  <div className="chip-grid">
                    {durationPresets.map((duration) => (
                      <button
                        key={duration.label}
                        type="button"
                        className={`chip ${form.durationMinutes === duration.value ? 'selected' : ''}`}
                        onClick={() => updateForm('durationMinutes', duration.value)}
                      >
                        {duration.label}
                      </button>
                    ))}
                  </div>
                </label>
                <label>
                  Длительность вручную (минут)
                  <input
                    type="number"
                    min={1}
                    value={form.durationMinutes}
                    onChange={(e) => updateForm('durationMinutes', Number(e.target.value) || 1)}
                    required
                  />
                </label>
              </article>

              <article className="card">
                <h3>Характер боли</h3>

                <div>
                  <p className="field-title">Локализация</p>
                  <div className="chip-grid">
                    {locationPresets.map((location) => (
                      <button
                        key={location}
                        type="button"
                        className={`chip ${form.location === location ? 'selected' : ''}`}
                        onClick={() => updateForm('location', location)}
                      >
                        {location}
                      </button>
                    ))}
                  </div>
                </div>

                <label>
                  Свой вариант локализации
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => updateForm('location', e.target.value)}
                    placeholder="Например: за глазом"
                    required
                  />
                </label>

                <div>
                  <p className="field-title">Тип боли</p>
                  <div className="chip-grid">
                    {painTypePresets.map((painType) => (
                      <button
                        key={painType}
                        type="button"
                        className={`chip ${form.painType === painType ? 'selected' : ''}`}
                        onClick={() => updateForm('painType', painType)}
                      >
                        {painType}
                      </button>
                    ))}
                  </div>
                </div>

                <label>
                  Свой вариант типа боли
                  <input
                    type="text"
                    value={form.painType}
                    onChange={(e) => updateForm('painType', e.target.value)}
                    placeholder="Например: распирающая"
                    required
                  />
                </label>

                {form.intensity === 10 && (
                  <label className="checkbox-row warning-surface">
                    <input
                      type="checkbox"
                      checked={form.worstHeadache}
                      onChange={(e) => updateForm('worstHeadache', e.target.checked)}
                    />
                    Это самая сильная головная боль в жизни
                  </label>
                )}

                {form.intensity === 10 && form.worstHeadache && (
                  <p className="warning-text">
                    При внезапной самой сильной головной боли обратитесь за срочной медицинской
                    помощью.
                  </p>
                )}
              </article>

              <article className="card">
                <h3>Симптомы и триггеры</h3>

                <div>
                  <p className="field-title">Симптомы</p>
                  <div className="chip-grid">
                    {symptomPresets.map((symptom) => (
                      <button
                        key={symptom}
                        type="button"
                        className={`chip ${form.symptoms.includes(symptom) ? 'selected' : ''}`}
                        onClick={() => toggleMulti('symptoms', symptom)}
                      >
                        {symptom}
                      </button>
                    ))}
                  </div>
                </div>

                <label>
                  Дополнить симптомы
                  <input
                    type="text"
                    value={form.symptomsCustom}
                    onChange={(e) => updateForm('symptomsCustom', e.target.value)}
                    placeholder="Например: затуманенное зрение"
                  />
                </label>

                <div>
                  <p className="field-title">Триггеры</p>
                  <div className="chip-grid">
                    {triggerPresets.map((trigger) => (
                      <button
                        key={trigger}
                        type="button"
                        className={`chip ${form.triggers.includes(trigger) ? 'selected' : ''}`}
                        onClick={() => toggleMulti('triggers', trigger)}
                      >
                        {trigger}
                      </button>
                    ))}
                  </div>
                </div>

                <label>
                  Дополнить триггеры
                  <input
                    type="text"
                    value={form.triggersCustom}
                    onChange={(e) => updateForm('triggersCustom', e.target.value)}
                    placeholder="Например: долгий экранный день"
                  />
                </label>
              </article>

              <article className="card">
                <h3>Лекарства и заметки</h3>

                <label>
                  Лекарство
                  <input
                    type="text"
                    value={form.medication}
                    onChange={(e) => updateForm('medication', e.target.value)}
                    placeholder="Что приняли и в какой дозе"
                  />
                </label>

                <label>
                  Комментарий
                  <textarea
                    value={form.comment}
                    onChange={(e) => updateForm('comment', e.target.value)}
                    placeholder="Как изменилось состояние после отдыха или лекарства"
                  />
                </label>

                <button className="primary-btn" type="submit">
                  Сохранить запись
                </button>
              </article>
            </form>
          </section>
        )}

        {screen === 'history' && (
          <section className="fade-in screen-content">
            <div className="section-row">
              <h2>История записей</h2>
              <button className="link-btn" onClick={() => setScreen('home')}>
                На главную
              </button>
            </div>

            <article className="card">
              {sortedEntries.length === 0 ? (
                <p className="muted">История пуста. Добавьте первую запись.</p>
              ) : (
                <ul className="entry-list history-list">
                  {sortedEntries.map((entry) => (
                    <li key={entry.id}>
                      <div className="entry-main">
                        <p className="entry-title">{formatDate(entry.startedAt)}</p>
                        <p className="muted">
                          Интенсивность {entry.intensity}/10 · {formatDuration(entry.durationMinutes)}
                        </p>
                        <p className="muted">Локализация: {entry.location}</p>
                        <p className="muted">Лекарство: {entry.medication || 'не указано'}</p>
                        {entry.worstHeadache && entry.intensity === 10 && (
                          <span className="red-flag">Красный флаг</span>
                        )}
                      </div>
                      <button className="soft-delete" onClick={() => deleteEntry(entry.id)}>
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        )}

        <footer className="disclaimer">Приложение не ставит диагноз и не заменяет врача.</footer>

        <nav className="bottom-nav">
          <button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}>
            Главная
          </button>
          <button className={screen === 'add' ? 'active' : ''} onClick={() => setScreen('add')}>
            Добавить
          </button>
          <button
            className={screen === 'history' ? 'active' : ''}
            onClick={() => setScreen('history')}
          >
            История
          </button>
        </nav>
      </main>
    </div>
  )
}

export default App
