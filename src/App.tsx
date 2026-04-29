import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import HeadacheChart from './components/HeadacheChart'
import { loadEntries, saveEntries } from './storage'
import type { HeadacheEntry } from './types'

type Screen = 'home' | 'add' | 'history' | 'detail'
type MenuOpen = { id: string; source: 'latest' | 'history' | 'detail' } | null

type FormState = {
  startedAt: string
  intensity: number
  durationMinutes: number
  location: string
  locationSelected: string[]
  locationCustom: string
  painType: string
  painTypeSelected: string[]
  painTypeCustom: string
  symptoms: string[]
  symptomsCustom: string
  medication: string
  triggers: string[]
  triggersCustom: string
  comment: string
  worstHeadache: boolean
}

const durationPresets = [{ label: '<30 мин', value: 20 }, { label: '1 час', value: 60 }, { label: '2–4 часа', value: 180 }, { label: 'Весь день', value: 1440 }]
const locationPresets = ['Лоб', 'Виски', 'Затылок', 'Одна сторона', 'Вся голова', 'Шея', 'За глазом']
const painTypePresets = ['Пульсирующая', 'Сдавливающая', 'Острая', 'Ноющая', 'Жгучая', 'Стреляющая', 'Распирающая']
const symptomPresets = ['Тошнота', 'Светобоязнь', 'Звукобоязнь', 'Аура', 'Головокружение', 'Слабость']
const triggerPresets = ['Стресс', 'Недосып', 'Погода', 'Пропуск еды', 'Алкоголь', 'Менструация']

const parseCommaValues = (value: string) => value.split(',').map((x) => x.trim()).filter(Boolean)
const buildCommaString = (presets: string[], custom: string) => [...presets, custom.trim()].filter(Boolean).join(', ')
const toDateInputState = (iso: string) => {
  const d = new Date(iso)
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(), hour: d.getHours(), minute: d.getMinutes() - (d.getMinutes() % 5) }
}
const createStartedAt = (day: number, month: number, year: number, hour: number, minute: number) => {
  const local = new Date(year, month - 1, day, hour, minute, 0, 0)
  return { isValidDate: local.getFullYear() === year && local.getMonth() === month - 1 && local.getDate() === day, iso: local.toISOString() }
}

const emptyForm = (): FormState => {
  const now = new Date()
  const roundedMinute = now.getMinutes() - (now.getMinutes() % 5)
  const startedAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinute).toISOString()
  return {
    startedAt,
    intensity: 5,
    durationMinutes: 60,
    location: 'Виски',
    locationSelected: ['Виски'],
    locationCustom: '',
    painType: 'Пульсирующая',
    painTypeSelected: ['Пульсирующая'],
    painTypeCustom: '',
    symptoms: [],
    symptomsCustom: '',
    medication: '',
    triggers: [],
    triggersCustom: '',
    comment: '',
    worstHeadache: false,
  }
}
const formatDate = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const formatDuration = (m: number) => m < 60 ? `${m} мин` : m === 60 ? '1 ч' : m >= 1440 ? 'Весь день' : m % 60 === 0 ? `${Math.floor(m / 60)} ч` : `${Math.floor(m / 60)} ч ${m % 60} мин`

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [entries, setEntries] = useState<HeadacheEntry[]>(() => loadEntries())
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<MenuOpen>(null)
  const [timeError, setTimeError] = useState('')

  const menuBoundaryRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!openMenu) return

    const closeOnOutside = (event: PointerEvent) => {
      const boundary = menuBoundaryRef.current
      if (!boundary) return
      if (!boundary.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }

    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
  }, [openMenu])

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)), [entries])
  const latestEntries = sortedEntries.slice(0, 3)
  const selectedEntry = sortedEntries.find((e) => e.id === selectedEntryId) || null
  const dateParts = useMemo(() => toDateInputState(form.startedAt), [form.startedAt])
  const currentYear = new Date().getFullYear()
  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((p) => ({ ...p, [key]: value }))
  const toggleMulti = (f: 'symptoms' | 'triggers' | 'locationSelected' | 'painTypeSelected', v: string) => setForm((p) => ({ ...p, [f]: p[f].includes(v) ? p[f].filter((x) => x !== v) : [...p[f], v] }))

  const updateDatePart = (key: 'day' | 'month' | 'year' | 'hour' | 'minute', value: number) => {
    const next = { ...dateParts, [key]: value }
    const composed = createStartedAt(next.day, next.month, next.year, next.hour, next.minute)
    if (composed.isValidDate) updateForm('startedAt', composed.iso)
  }

  const openDetail = (id: string) => { setSelectedEntryId(id); setScreen('detail'); setOpenMenu(null) }
  const startEdit = (entry: HeadacheEntry) => {
    const locations = parseCommaValues(entry.location)
    const painTypes = parseCommaValues(entry.painType)
    const knownLocations = locationPresets.filter((x) => locations.includes(x))
    const knownPainTypes = painTypePresets.filter((x) => painTypes.includes(x))
    setEditingEntryId(entry.id)
    setForm({ startedAt: entry.startedAt, intensity: entry.intensity, durationMinutes: entry.durationMinutes, location: entry.location, locationSelected: knownLocations, locationCustom: locations.filter((x) => !locationPresets.includes(x)).join(', '), painType: entry.painType, painTypeSelected: knownPainTypes, painTypeCustom: painTypes.filter((x) => !painTypePresets.includes(x)).join(', '), symptoms: symptomPresets.filter((x) => entry.symptoms.includes(x)), symptomsCustom: '', medication: entry.medication, triggers: triggerPresets.filter((x) => entry.triggers.includes(x)), triggersCustom: '', comment: entry.comment, worstHeadache: entry.worstHeadache })
    setScreen('add'); setOpenMenu(null); setTimeError('')
  }

  const deleteEntry = (id: string) => { if (!window.confirm('Удалить эту запись?')) return; const next = entries.filter((e) => e.id !== id); setEntries(next); saveEntries(next); if (selectedEntryId === id) { setSelectedEntryId(null); setScreen('history') } setOpenMenu(null) }
  const saveEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const dateCheck = createStartedAt(dateParts.day, dateParts.month, dateParts.year, dateParts.hour, dateParts.minute)
    if (!dateCheck.isValidDate) { setTimeError('Проверьте корректность даты и времени.'); return }
    if (new Date(dateCheck.iso).getTime() > Date.now()) { setTimeError('Нельзя сохранить эпизод в будущем.'); return }
    setTimeError('')
    const symptoms = [...form.symptoms, form.symptomsCustom.trim()].filter(Boolean).join(', ')
    const triggers = [...form.triggers, form.triggersCustom.trim()].filter(Boolean).join(', ')
    const location = buildCommaString(form.locationSelected, form.locationCustom)
    const painType = buildCommaString(form.painTypeSelected, form.painTypeCustom)
    const base = { startedAt: dateCheck.iso, intensity: form.intensity, durationMinutes: form.durationMinutes, location: location || form.location, painType: painType || form.painType, symptoms, medication: form.medication.trim(), triggers, comment: form.comment.trim(), worstHeadache: form.intensity === 10 ? form.worstHeadache : false }
    let next: HeadacheEntry[]; let focusId = editingEntryId
    if (editingEntryId) next = entries.map((e) => e.id === editingEntryId ? { ...e, ...base } : e)
    else { const created = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...base }; next = [created, ...entries]; focusId = created.id }
    setEntries(next); saveEntries(next); setForm(emptyForm()); setEditingEntryId(null); setSelectedEntryId(focusId || null); setScreen(focusId ? 'detail' : 'home')
  }

  return <div className="app-shell"><main className="phone-frame"><div ref={menuBoundaryRef}>{screen === 'home' && <section className="fade-in screen-content"><header><h1>Дневник здоровья</h1><p className="subtitle">Спокойно фиксируйте важные симптомы</p></header><article className="card hero"><h2>Мягкий ритм наблюдений</h2><p>Записывайте эпизоды в несколько касаний и отслеживайте важные детали для следующей консультации.</p><button className="primary-btn" onClick={() => { setEditingEntryId(null); setForm(emptyForm()); setScreen('add') }}>+ Добавить головную боль</button></article><article className="card"><h3>Динамика за 30 дней</h3><HeadacheChart entries={entries} /></article><article className="card"><div className="stats-grid four-cols"><div><strong>{sortedEntries.length}</strong><span>всего записей</span></div><div><strong>{sortedEntries.filter((e) => e.medication.trim()).length}</strong><span>с лекарством</span></div></div><div className="section-row"><h3>Последние записи</h3><button className="link-btn" onClick={() => setScreen('history')}>Вся история</button></div>{latestEntries.length===0?<div className="empty-state"><p className="entry-title">Пока записей нет</p><button className="soft-btn" onClick={() => setScreen('add')}>Добавить первую запись</button></div>:<ul className="entry-list compact">{latestEntries.map((entry)=><li key={entry.id}><button className="entry-tap" onClick={() => openDetail(entry.id)}><p className="entry-title">{formatDate(entry.startedAt)}</p><p className="muted">{entry.intensity}/10 · {formatDuration(entry.durationMinutes)}</p></button><div className="row-actions"><span className="badge">{entry.location}</span><button className="menu-btn" onClick={() => setOpenMenu(openMenu?.id===entry.id?null:{id:entry.id,source:'latest'})}>⋯</button>{openMenu?.id===entry.id && <div className="context-menu"><button onClick={() => startEdit(entry)}>Редактировать</button><button onClick={() => deleteEntry(entry.id)}>Удалить</button></div>}</div></li>)}</ul>}</article></section>}
{screen==='add'&&<section className="fade-in screen-content"><div className="section-row"><h2>{editingEntryId ? 'Редактировать запись' : 'Новая запись'}</h2><button className="link-btn" onClick={()=>setScreen(selectedEntryId?'detail':'home')}>Назад</button></div><form className="form" onSubmit={saveEntry}><article className="card"><h3>Главное</h3><p className="field-title">Начало эпизода</p><div className="date-time-grid"><label>День<select value={dateParts.day} onChange={(e)=>updateDatePart('day', Number(e.target.value))}>{Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><label>Месяц<select value={dateParts.month} onChange={(e)=>updateDatePart('month', Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label><label>Год<select value={dateParts.year} onChange={(e)=>updateDatePart('year', Number(e.target.value))}>{Array.from({length:3},(_,i)=><option key={currentYear-2+i} value={currentYear-2+i}>{currentYear-2+i}</option>)}</select></label><label>Часы<select value={dateParts.hour} onChange={(e)=>updateDatePart('hour', Number(e.target.value))}>{Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}</option>)}</select></label><label>Минуты<select value={dateParts.minute} onChange={(e)=>updateDatePart('minute', Number(e.target.value))}>{Array.from({length:12},(_,i)=>i*5).map((minute)=><option key={minute} value={minute}>{String(minute).padStart(2,'0')}</option>)}</select></label></div>{timeError&&<p className="warning-text">{timeError}</p>}<label>Интенсивность: {form.intensity}/10<input type="range" min={0} max={10} step={1} value={form.intensity} onChange={(e)=>updateForm('intensity',Number(e.target.value))}/></label><label>Длительность<div className="chip-grid">{durationPresets.map((d)=><button key={d.label} type="button" className={`chip ${form.durationMinutes===d.value?'selected':''}`} onClick={()=>updateForm('durationMinutes',d.value)}>{d.label}</button>)}</div></label><div className="duration-wheel"><button type="button" onClick={()=>updateForm('durationMinutes',Math.max(0,form.durationMinutes-60))}>−</button><div><strong>{Math.floor(form.durationMinutes/60)} ч</strong><strong>{form.durationMinutes%60} мин</strong></div><button type="button" onClick={()=>updateForm('durationMinutes',Math.min(24*60,form.durationMinutes+5))}>+</button></div></article><article className="card"><h3>Характер боли</h3><div><p className="field-title">Локализация</p><div className="chip-grid">{locationPresets.map((x)=><button key={x} type="button" className={`chip ${form.locationSelected.includes(x)?'selected':''}`} onClick={()=>toggleMulti('locationSelected',x)}>{x}</button>)}</div></div><label>Свой вариант локализации<input type="text" value={form.locationCustom} onChange={(e)=>updateForm('locationCustom',e.target.value)} /></label><div><p className="field-title">Тип боли</p><div className="chip-grid">{painTypePresets.map((x)=><button key={x} type="button" className={`chip ${form.painTypeSelected.includes(x)?'selected':''}`} onClick={()=>toggleMulti('painTypeSelected',x)}>{x}</button>)}</div></div><label>Свой вариант типа боли<input type="text" value={form.painTypeCustom} onChange={(e)=>updateForm('painTypeCustom',e.target.value)} /></label>{form.intensity===10&&<label className="checkbox-row warning-surface"><input type="checkbox" checked={form.worstHeadache} onChange={(e)=>updateForm('worstHeadache',e.target.checked)}/>Это самая сильная головная боль в жизни</label>}{form.intensity===10&&form.worstHeadache&&<p className="warning-text">При внезапной самой сильной головной боли обратитесь за срочной медицинской помощью.</p>}</article><article className="card"><h3>Симптомы и триггеры</h3><div><p className="field-title">Симптомы</p><div className="chip-grid">{symptomPresets.map((x)=><button key={x} type="button" className={`chip ${form.symptoms.includes(x)?'selected':''}`} onClick={()=>toggleMulti('symptoms',x)}>{x}</button>)}</div></div><label>Дополнить симптомы<input type="text" value={form.symptomsCustom} onChange={(e)=>updateForm('symptomsCustom',e.target.value)}/></label><div><p className="field-title">Триггеры</p><div className="chip-grid">{triggerPresets.map((x)=><button key={x} type="button" className={`chip ${form.triggers.includes(x)?'selected':''}`} onClick={()=>toggleMulti('triggers',x)}>{x}</button>)}</div></div><label>Дополнить триггеры<input type="text" value={form.triggersCustom} onChange={(e)=>updateForm('triggersCustom',e.target.value)}/></label></article><article className="card"><h3>Лекарства и заметки</h3><label>Лекарство<input type="text" value={form.medication} onChange={(e)=>updateForm('medication',e.target.value)} /></label><label>Комментарий<textarea value={form.comment} onChange={(e)=>updateForm('comment',e.target.value)} /></label><button className="primary-btn" type="submit">{editingEntryId ? 'Сохранить изменения' : 'Сохранить запись'}</button></article></form></section>}
{screen==='history'&&<section className="fade-in screen-content"><div className="section-row"><h2>История записей</h2><button className="link-btn" onClick={()=>setScreen('home')}>На главную</button></div><article className="card"><ul className="entry-list history-list">{sortedEntries.map((entry)=><li key={entry.id}><button className="entry-tap" onClick={()=>openDetail(entry.id)}><p className="entry-title">{formatDate(entry.startedAt)}</p><p className="muted">Интенсивность {entry.intensity}/10 · {formatDuration(entry.durationMinutes)}</p></button><div className="row-actions"><button className="menu-btn" onClick={()=>setOpenMenu(openMenu?.id===entry.id?null:{id:entry.id,source:'history'})}>⋯</button>{openMenu?.id===entry.id&&<div className="context-menu"><button onClick={()=>startEdit(entry)}>Редактировать</button><button onClick={()=>deleteEntry(entry.id)}>Удалить</button></div>}</div></li>)}</ul></article></section>}
{screen==='detail'&&selectedEntry&&<section className="fade-in screen-content"><div className="section-row"><h2>Детали записи</h2><div className="row-actions"><button className="link-btn" onClick={()=>setScreen('history')}>Назад</button><button className="menu-btn" onClick={()=>setOpenMenu(openMenu?.source==='detail'?null:{id:selectedEntry.id,source:'detail'})}>⋯</button>{openMenu?.source==='detail'&&<div className="context-menu"><button onClick={()=>startEdit(selectedEntry)}>Редактировать</button><button onClick={()=>deleteEntry(selectedEntry.id)}>Удалить</button></div>}</div></div><article className="card details-grid"><p><strong>Дата и время:</strong> {formatDate(selectedEntry.startedAt)}</p><p><strong>Интенсивность:</strong> {selectedEntry.intensity}/10</p><p><strong>Длительность:</strong> {formatDuration(selectedEntry.durationMinutes)}</p><p><strong>Локализация:</strong> {selectedEntry.location}</p><p><strong>Тип боли:</strong> {selectedEntry.painType}</p><p><strong>Симптомы:</strong> {selectedEntry.symptoms || 'не указано'}</p><p><strong>Триггеры:</strong> {selectedEntry.triggers || 'не указано'}</p><p><strong>Лекарство:</strong> {selectedEntry.medication || 'не указано'}</p><p><strong>Комментарий:</strong> {selectedEntry.comment || 'не указано'}</p>{selectedEntry.worstHeadache&&selectedEntry.intensity===10&&<p className="red-flag">Красный флаг: самая сильная головная боль</p>}</article></section>}
</div><footer className="disclaimer">Приложение не ставит диагноз и не заменяет врача.</footer><nav className="bottom-nav"><button className={screen==='home'?'active':''} onClick={()=>setScreen('home')}>Главная</button><button className={screen==='add'?'active':''} onClick={()=>setScreen('add')}>Добавить</button><button className={screen==='history'?'active':''} onClick={()=>setScreen('history')}>История</button></nav></main></div>
}

export default App
