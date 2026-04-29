import { useMemo, useState } from 'react'
import './App.css'
import { HeadacheChart } from './components/HeadacheChart'
import { loadEntries, saveEntries } from './storage'
import type { HeadacheEntry } from './types'

type Screen = 'home' | 'add' | 'history' | 'detail'

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
    hour12: false,
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

const entryToForm = (entry: HeadacheEntry): FormState => ({
  startedAt: entry.startedAt.slice(0, 16),
  intensity: entry.intensity,
  durationMinutes: entry.durationMinutes,
  location: entry.location,
  painType: entry.painType,
  symptoms: symptomPresets.filter((s) => entry.symptoms.includes(s)),
  symptomsCustom: '',
  medication: entry.medication,
  triggers: triggerPresets.filter((t) => entry.triggers.includes(t)),
  triggersCustom: '',
  comment: entry.comment,
  worstHeadache: entry.worstHeadache,
})

function App() {
  // v0.2 merged screen flows: home/add/history/detail
  const [screen, setScreen] = useState<Screen>('home')
  const [entries, setEntries] = useState<HeadacheEntry[]>(() => loadEntries())
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const [detailMenuOpen, setDetailMenuOpen] = useState(false)

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)),
    [entries],
  )
  const selectedEntry = useMemo(
    () => sortedEntries.find((entry) => entry.id === selectedEntryId) ?? null,
    [selectedEntryId, sortedEntries],
  )
  const latestEntries = sortedEntries.slice(0, 3)

  const stats30 = useMemo(() => {
    const now = Date.now()
    const in30Days = sortedEntries.filter((entry) => now - +new Date(entry.startedAt) <= 30 * 24 * 60 * 60 * 1000)
    const entriesCount = in30Days.length
    const avgIntensity = entriesCount
      ? (in30Days.reduce((acc, entry) => acc + entry.intensity, 0) / entriesCount).toFixed(1)
      : '0'
    const medicationDays = new Set(
      in30Days.filter((entry) => entry.medication.trim()).map((entry) => new Date(entry.startedAt).toISOString().slice(0, 10)),
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
      const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
      return { ...prev, [field]: next }
    })
  }

  const openDetail = (id: string) => {
    setSelectedEntryId(id)
    setMenuOpenFor(null)
    setScreen('detail')
  }

  const askDelete = (id: string) => {
    if (!window.confirm('Удалить эту запись?')) return
    const next = entries.filter((entry) => entry.id !== id)
    setEntries(next)
    saveEntries(next)
    setMenuOpenFor(null)
    setDetailMenuOpen(false)
    if (selectedEntryId === id) {
      setSelectedEntryId(null)
      setScreen('history')
    }
  }

  const startEdit = (entry: HeadacheEntry) => {
    setEditingEntryId(entry.id)
    setSelectedEntryId(entry.id)
    setForm(entryToForm(entry))
    setDetailMenuOpen(false)
    setMenuOpenFor(null)
    setScreen('add')
  }

  const saveEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const symptoms = [...form.symptoms, form.symptomsCustom.trim()].filter(Boolean).join(', ')
    const triggers = [...form.triggers, form.triggersCustom.trim()].filter(Boolean).join(', ')

    if (editingEntryId) {
      const next = entries.map((entry) =>
        entry.id === editingEntryId
          ? {
              ...entry,
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
          : entry,
      )
      setEntries(next)
      saveEntries(next)
      setForm(emptyForm())
      setEditingEntryId(null)
      setScreen('detail')
      return
    }

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
    setSelectedEntryId(nextEntry.id)
    setScreen('detail')
  }

  const selectedHours = Math.floor(form.durationMinutes / 60)
  const selectedMinutes = form.durationMinutes % 60

  return (
    <div className="app-shell" onClick={() => setMenuOpenFor(null)}>
      <main className="phone-frame">
        {screen === 'home' && (
          <section className="fade-in screen-content">
            <header>
              <h1>Дневник здоровья</h1>
              <p className="subtitle">Спокойно фиксируйте важные симптомы</p>
            </header>
            <article className="card hero">
              <h2>Мягкий ритм наблюдений</h2>
              <p>Записывайте эпизоды в несколько касаний и отслеживайте важные детали для консультации.</p>
              <button className="primary-btn" onClick={() => { setEditingEntryId(null); setForm(emptyForm()); setScreen('add') }}>
                + Добавить головную боль
              </button>
            </article>

            <article className="card">
              <h3>Динамика за 30 дней</h3>
              <HeadacheChart entries={sortedEntries} />
              <div className="stats-grid four-cols">
                <div><strong>{stats30.entriesCount}</strong><span>записей</span></div>
                <div><strong>{stats30.avgIntensity}</strong><span>средняя интенсивность</span></div>
                <div><strong>{stats30.medicationDays}</strong><span>дней с лекарствами</span></div>
                <div><strong>{stats30.redFlags}</strong><span>красных флагов</span></div>
              </div>
            </article>

            <article className="card">
              <div className="section-row"><h3>Последние записи</h3><button className="link-btn" onClick={() => setScreen('history')}>Вся история</button></div>
              {latestEntries.length === 0 ? <div className="empty-state"><p className="entry-title">Пока записей нет</p></div> : (
                <ul className="entry-list compact">
                  {latestEntries.map((entry) => (
                    <li key={entry.id} className="tappable" onClick={() => openDetail(entry.id)}>
                      <div><p className="entry-title">{formatDate(entry.startedAt)}</p><p className="muted">{entry.intensity}/10 · {formatDuration(entry.durationMinutes)}</p></div>
                      <div className="entry-right" onClick={(e) => e.stopPropagation()}>
                        <span className="badge">{entry.location}</span>
                        <button className="menu-btn" onClick={() => setMenuOpenFor(menuOpenFor === entry.id ? null : entry.id)}>⋯</button>
                        {menuOpenFor === entry.id && (
                          <div className="context-menu">
                            <button onClick={() => startEdit(entry)}>Редактировать</button>
                            <button onClick={() => askDelete(entry.id)}>Удалить</button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        )}

        {screen === 'add' && (
          <section className="fade-in screen-content">
            <div className="section-row"><h2>{editingEntryId ? 'Редактировать запись' : 'Новая запись'}</h2><button className="link-btn" onClick={() => setScreen(editingEntryId ? 'detail' : 'home')}>Назад</button></div>
            <form className="form" onSubmit={saveEntry}>
              <article className="card"><h3>Главное</h3>
                <label>Начало эпизода<input type="datetime-local" value={form.startedAt} onChange={(e) => updateForm('startedAt', e.target.value)} required /></label>
                <label>Интенсивность: {form.intensity}/10<input type="range" min={0} max={10} value={form.intensity} onChange={(e) => updateForm('intensity', Number(e.target.value))} /></label>
                <label>Длительность<div className="chip-grid">{durationPresets.map((d) => <button key={d.label} type="button" className={`chip ${form.durationMinutes===d.value?'selected':''}`} onClick={() => updateForm('durationMinutes', d.value)}>{d.label}</button>)}</div></label>
                <div className="wheel-picker">
                  <div><p className="field-title">Часы</p><div className="wheel-col">{Array.from({ length: 25 }).map((_,h)=><button key={h} type="button" className={`wheel-item ${selectedHours===h?'selected':''}`} onClick={()=>updateForm('durationMinutes', h*60+selectedMinutes)}>{h}</button>)}</div></div>
                  <div><p className="field-title">Минуты</p><div className="wheel-col">{Array.from({ length: 12 }).map((_,i)=>i*5).map((m)=><button key={m} type="button" className={`wheel-item ${selectedMinutes===m?'selected':''}`} onClick={()=>updateForm('durationMinutes', selectedHours*60+m)}>{String(m).padStart(2,'0')}</button>)}</div></div>
                </div>
              </article>
              <article className="card"><h3>Характер боли</h3>
                <p className="field-title">Локализация</p><div className="chip-grid">{locationPresets.map((v)=><button key={v} type="button" className={`chip ${form.location===v?'selected':''}`} onClick={()=>updateForm('location',v)}>{v}</button>)}</div>
                <label>Свой вариант локализации<input type="text" value={form.location} onChange={(e)=>updateForm('location',e.target.value)} required /></label>
                <p className="field-title">Тип боли</p><div className="chip-grid">{painTypePresets.map((v)=><button key={v} type="button" className={`chip ${form.painType===v?'selected':''}`} onClick={()=>updateForm('painType',v)}>{v}</button>)}</div>
                <label>Свой вариант типа боли<input type="text" value={form.painType} onChange={(e)=>updateForm('painType',e.target.value)} required /></label>
                {form.intensity===10 && <label className="checkbox-row warning-surface"><input type="checkbox" checked={form.worstHeadache} onChange={(e)=>updateForm('worstHeadache',e.target.checked)} />Это самая сильная головная боль в жизни</label>}
                {form.intensity===10 && form.worstHeadache && <p className="warning-text">При внезапной самой сильной головной боли обратитесь за срочной медицинской помощью.</p>}
              </article>
              <article className="card"><h3>Симптомы и триггеры</h3>
                <p className="field-title">Симптомы</p><div className="chip-grid">{symptomPresets.map((v)=><button key={v} type="button" className={`chip ${form.symptoms.includes(v)?'selected':''}`} onClick={()=>toggleMulti('symptoms',v)}>{v}</button>)}</div>
                <label>Дополнить симптомы<input type="text" value={form.symptomsCustom} onChange={(e)=>updateForm('symptomsCustom',e.target.value)} /></label>
                <p className="field-title">Триггеры</p><div className="chip-grid">{triggerPresets.map((v)=><button key={v} type="button" className={`chip ${form.triggers.includes(v)?'selected':''}`} onClick={()=>toggleMulti('triggers',v)}>{v}</button>)}</div>
                <label>Дополнить триггеры<input type="text" value={form.triggersCustom} onChange={(e)=>updateForm('triggersCustom',e.target.value)} /></label>
              </article>
              <article className="card"><h3>Лекарства и заметки</h3>
                <label>Лекарство<input type="text" value={form.medication} onChange={(e)=>updateForm('medication',e.target.value)} /></label>
                <label>Комментарий<textarea value={form.comment} onChange={(e)=>updateForm('comment',e.target.value)} /></label>
                <button className="primary-btn" type="submit">{editingEntryId ? 'Сохранить изменения' : 'Сохранить запись'}</button>
              </article>
            </form>
          </section>
        )}

        {screen === 'history' && (
          <section className="fade-in screen-content">
            <div className="section-row"><h2>История записей</h2><button className="link-btn" onClick={() => setScreen('home')}>На главную</button></div>
            <article className="card">{sortedEntries.length===0 ? <p className="muted">История пуста.</p> : (
              <ul className="entry-list history-list">{sortedEntries.map((entry)=>(
                <li key={entry.id} className="tappable" onClick={() => openDetail(entry.id)}>
                  <div className="entry-main"><p className="entry-title">{formatDate(entry.startedAt)}</p><p className="muted">{entry.intensity}/10 · {formatDuration(entry.durationMinutes)}</p><p className="muted">{entry.location} · {entry.medication || 'без лекарства'}</p>{entry.worstHeadache && entry.intensity===10 && <span className="red-flag">Красный флаг</span>}</div>
                  <div className="entry-right" onClick={(e) => e.stopPropagation()}>
                    <button className="menu-btn" onClick={() => setMenuOpenFor(menuOpenFor === entry.id ? null : entry.id)}>⋯</button>
                    {menuOpenFor === entry.id && <div className="context-menu"><button onClick={() => startEdit(entry)}>Редактировать</button><button onClick={() => askDelete(entry.id)}>Удалить</button></div>}
                  </div>
                </li>
              ))}</ul>
            )}</article>
          </section>
        )}

        {screen === 'detail' && selectedEntry && (
          <section className="fade-in screen-content">
            <div className="section-row"><h2>Детали эпизода</h2><div className="entry-right"><button className="menu-btn" onClick={() => setDetailMenuOpen((v) => !v)}>⋯</button>{detailMenuOpen && <div className="context-menu"><button onClick={() => startEdit(selectedEntry)}>Редактировать</button><button onClick={() => askDelete(selectedEntry.id)}>Удалить</button></div>}</div></div>
            <article className="card detail-grid">
              <p><strong>Дата и время:</strong> {formatDate(selectedEntry.startedAt)}</p>
              <p><strong>Интенсивность:</strong> {selectedEntry.intensity}/10</p>
              <p><strong>Длительность:</strong> {formatDuration(selectedEntry.durationMinutes)}</p>
              <p><strong>Локализация:</strong> {selectedEntry.location}</p>
              <p><strong>Тип боли:</strong> {selectedEntry.painType}</p>
              <p><strong>Симптомы:</strong> {selectedEntry.symptoms || 'не указано'}</p>
              <p><strong>Триггеры:</strong> {selectedEntry.triggers || 'не указано'}</p>
              <p><strong>Лекарство:</strong> {selectedEntry.medication || 'не указано'}</p>
              <p><strong>Комментарий:</strong> {selectedEntry.comment || 'не указано'}</p>
              {selectedEntry.intensity === 10 && selectedEntry.worstHeadache && <p className="warning-text">При внезапной самой сильной головной боли обратитесь за срочной медицинской помощью.</p>}
            </article>
            <button className="link-btn" onClick={() => setScreen('history')}>К истории</button>
          </section>
        )}

        <footer className="disclaimer">Приложение не ставит диагноз и не заменяет врача.</footer>

        <nav className="bottom-nav">
          <button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}>Главная</button>
          <button className={screen === 'add' ? 'active' : ''} onClick={() => { setEditingEntryId(null); setForm(emptyForm()); setScreen('add') }}>Добавить</button>
          <button className={screen === 'history' ? 'active' : ''} onClick={() => setScreen('history')}>История</button>
        </nav>
      </main>
    </div>
  )
}

export default App
