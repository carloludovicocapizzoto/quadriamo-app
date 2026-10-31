// Analisi → Calendario: quello che succederà ai tuoi soldi, da capire in pochi secondi. Nel mese: il riepilogo (quanto resta
// a fine mese, entrate, uscite, già pagato, da pagare), la griglia con un punto per tipo (uscite, entrate, risparmi,
// promemoria) e i giorni più pesanti in evidenza, poi la settimana del giorno scelto come timeline. Le altre viste
// (giorno, settimana, agenda) usano la stessa timeline.
import { useMemo, useState } from 'react'
import { GOAL_EVENT, addDays, agenda, daysBetween, linkedOccurrences, forecastMonth, goalEvents, goalStatus, makeDate, monthOf, parseDate, periodSummary, toneOf, type CalEvent, type MonthResult, type Settings } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { navigate } from '../../app/router'
import { local } from '../../storage'
import { useStore } from '../../store/context'
import { Icon } from '../Icon'
import { Empty } from '../kit/Empty'
import { Money } from '../kit/Money'
import { tap } from '../kit/motion'
import { Sheet } from '../kit/Sheet'
import { EventDetail } from './EventDetail'
import { EventForm } from './EventForm'
import { MonthSummary } from './MonthSummary'
import { Suggestions } from './Suggestions'
import { Timeline, type Item } from './Timeline'
import { blankEvent, useEvents } from './useEvents'

type Mode = 'day' | 'week' | 'month' | 'agenda'
const MODES: Mode[] = ['day', 'week', 'month', 'agenda']
const MODE_KEY = 'q.calMode'
const k = (s: string) => s as keyof Dict
const AGENDA_DAYS = 60

/** Il lunedì della settimana di `iso`. */
const monday = (iso: string) => addDays(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7))

export function CalendarView({ settings, today, current }: { settings: Settings; today: string; current: MonthResult }) {
  const { t, date, lang, money } = useI18n()
  const { events: own, save, remove, toggleDone } = useEvents()
  // con le scadenze degli obiettivi (si toccano per aprire l'obiettivo)
  const store = useStore().state.data
  const goals = store?.goals
  // le volte pagate da un movimento collegato sono fatte: «Già pagato», niente «Segna come fatto»
  const paid = useMemo(() => linkedOccurrences(store?.transactions ?? [], settings), [store?.transactions, settings])
  const events = useMemo(() => [...own, ...goalEvents(goals, today, name => t('cal.goalDue', { name }))], [own, goals, today, t])
  const [mode, setModeState] = useState<Mode>(() => (MODES as string[]).includes(local.get(MODE_KEY) ?? '') ? local.get(MODE_KEY) as Mode : 'month')
  const [day, setDay] = useState(today)
  const [open, setOpen] = useState<{ event: CalEvent; date: string } | null>(null)
  const [edit, setEdit] = useState<CalEvent | null>(null)
  const cur = settings.currency
  const setMode = (m: Mode) => { setModeState(m); local.set(MODE_KEY, m) }

  // l'intervallo della vista: un giorno, la settimana da lunedì, il mese (con le settimane intere), 60 giorni da oggi
  const { from, to, title } = useMemo(() => {
    const p = parseDate(day)
    if (mode === 'day') return { from: day, to: day, title: date(day, { weekday: 'long', day: 'numeric', month: 'long' }) }
    if (mode === 'week') { const m = monday(day); return { from: m, to: addDays(m, 6), title: `${date(m, { day: 'numeric', month: 'short' })} – ${date(addDays(m, 6), { day: 'numeric', month: 'short' })}` } }
    if (mode === 'month') {
      const first = makeDate(p.year, p.month, 1), last = makeDate(p.year, p.month + 1, 0)
      return { from: monday(first), to: addDays(monday(last), 6), title: date(first, { month: 'long', year: 'numeric' }) }
    }
    return { from: today, to: addDays(today, AGENDA_DAYS - 1), title: t('cal.next', { n: AGENDA_DAYS }) }
  }, [mode, day, today, date, t])
  const items = useMemo(() => agenda(events, from, to, paid), [events, from, to, paid])
  const byDay = useMemo(() => {
    const m = new Map<string, typeof items>()
    for (const x of items) m.set(x.date, [...(m.get(x.date) ?? []), x])
    return m
  }, [items])

  const move = (dir: 1 | -1) => {
    tap()
    const p = parseDate(day)
    setDay(mode === 'day' ? addDays(day, dir) : mode === 'week' ? addDays(day, 7 * dir) : makeDate(p.year, p.month + dir, 1))
  }
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(lang, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 5 + i)))), [lang])

  const kindLabel = (e: CalEvent) => {
    if (!e.id.startsWith(GOAL_EVENT)) return t(k(`ev.kind.${e.kind}`))
    const g = goals?.find(x => GOAL_EVENT + x.id === e.id)
    return g ? t('cal.goalLeft', { amount: money(goalStatus(g, today).left, cur) }) : ''
  }
  const openItem = (x: Item) => { if (x.event.id.startsWith(GOAL_EVENT)) navigate({ tab: 'profile', page: 'goals' }); else if (x.event.kind === 'document') navigate({ tab: 'profile', page: 'documents' }); else setOpen({ event: x.event, date: x.date }) }
  const timeline = (days: string[], compactEmpty = false) =>
    <Timeline days={days} byDay={byDay} today={today} selected={mode === 'month' ? day : undefined} currency={cur} compactEmpty={compactEmpty} label={kindLabel} onOpen={openItem} />

  if (!events.length) return <>
    <Empty title={t('cal.emptyTitle')} text={t('cal.emptyText')} action={{ label: t('cal.add'), onClick: () => setEdit(blankEvent(today)) }} />
    <Suggestions today={today} onAdd={setEdit} />
    <Sheet open={!!edit} onClose={() => setEdit(null)} title={t('cal.add')}>
      {edit && <EventForm event={edit} settings={settings} today={today} onSave={e => { save(e); setEdit(null) }} />}
    </Sheet>
  </>

  // il mese di calendario mostrato: i suoi conti; quanto resta a fine mese solo se è il periodo di budget in corso
  const monthItems = items.filter(x => x.date.slice(0, 7) === day.slice(0, 7))
  const sum = periodSummary(mode === 'month' ? monthItems : items, today)
  const viewed = monthOf(day, settings.monthStartDay)
  const leftOver = viewed.year === current.ym.year && viewed.month === current.ym.month ? forecastMonth(current, today)?.projectedLeftOver ?? null : null
  const heavy = new Set(sum.heavy)
  return (
    <div className="calendar">
      {/* le viste come pillole leggere: sopra ci sono già le schede di Analisi */}
      <div className="chips cal-modes" role="tablist" aria-label={t('cal.title')}>
        {MODES.map(m => <button key={m} type="button" role="tab" aria-selected={mode === m} className={`chip${mode === m ? ' on' : ''}`}
          onClick={() => { tap(); setMode(m) }}>{t(k(`cal.view.${m}`))}</button>)}
      </div>

      {mode !== 'agenda' && <div className="month-nav">
        <button className="icon-btn" aria-label={t('cal.prev')} onClick={() => move(-1)}><Icon name="back" size={20} /></button>
        <h2>{title.charAt(0).toUpperCase() + title.slice(1)}</h2>
        <button className="icon-btn" aria-label={t('cal.nextPeriod')} onClick={() => move(1)}><Icon name="chevron" size={20} /></button>
      </div>}
      {mode !== 'agenda' && day !== today && <button className="link-btn cal-today" onClick={() => { tap(); setDay(today) }}>{t('cal.today')}</button>}

      {mode === 'month' ? <MonthSummary s={sum} leftOver={leftOver} currency={cur} />
        : (sum.toPay > 0 || sum.income > 0) && <dl className="cal-sum">
          {sum.toPay > 0 && <div><dt>{t('cal.out')}</dt><dd><Money value={sum.toPay} currency={cur} /></dd></div>}
          {sum.income > 0 && <div><dt>{t('cal.in')}</dt><dd><Money value={sum.income} currency={cur} /></dd></div>}
        </dl>}

      {mode === 'month' && <div className="cal-month" role="grid" aria-label={title}>
        {weekdays.map((w, i) => <span key={i} className="cal-wd" aria-hidden="true">{w}</span>)}
        {Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i)).map(d => {
          const list = byDay.get(d) ?? []
          const tones = (['out', 'in', 'save', 'note'] as const).filter(tn => list.some(x => toneOf(x.event.kind) === tn))
          const outside = d.slice(0, 7) !== day.slice(0, 7)
          return <button key={d} role="gridcell" aria-selected={d === day} aria-label={`${date(d, { day: 'numeric', month: 'long' })}${list.length ? `, ${list.length}` : ''}`}
            className={`cal-day${d === day ? ' on' : ''}${d === today ? ' today' : ''}${outside ? ' out' : ''}${heavy.has(d) && !outside ? ' heavy' : ''}`} onClick={() => { tap(); setDay(d) }}>
            <span>{parseDate(d).day}</span>
            <i className="cal-dots" aria-hidden="true">{tones.map(tn => <b key={tn} className={`tone-${tn}`} />)}</i>
          </button>
        })}
      </div>}
      {mode === 'month' && <p className="cal-legend" aria-hidden="true">
        {(['out', 'in', 'save', 'note'] as const).filter(tn => monthItems.some(x => toneOf(x.event.kind) === tn)).map(tn => <span key={tn} className={`tone-${tn}`}><b />{t(k(`cal.tone.${tn}`))}</span>)}
        {heavy.size > 0 && <span className="heavy-key">{t('cal.heavy')}</span>}
      </p>}

      {mode === 'month' ? <>
        <h3 className="cal-week-title">{t('cal.week', { from: date(monday(day), { day: 'numeric', month: 'short' }), to: date(addDays(monday(day), 6), { day: 'numeric', month: 'short' }) })}</h3>
        {/* della settimana, solo i giorni con qualcosa e quello scelto */}
        {timeline(Array.from({ length: 7 }, (_, i) => addDays(monday(day), i)).filter(d => d === day || byDay.has(d)))}
      </> : mode === 'day' ? timeline([day])
        : mode === 'week' ? timeline(Array.from({ length: 7 }, (_, i) => addDays(from, i)), true)
        : items.length ? timeline([...byDay.keys()]) : <p className="muted small cal-none">{t('cal.nothingAgenda', { n: AGENDA_DAYS })}</p>}

      <Suggestions today={today} onAdd={setEdit} />
      <button className="link-btn cal-add" onClick={() => { tap(); setEdit(blankEvent(mode === 'agenda' ? today : day)) }}>+ {t('cal.add')}</button>

      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && <EventDetail event={events.find(e => e.id === open.event.id) ?? open.event} date={open.date} currency={cur} today={today}
          onToggle={() => toggleDone(open.event.id, open.date)} onEdit={() => { setEdit(open.event); setOpen(null) }} />}
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit && events.some(e => e.id === edit.id) ? t('ev.edit') : t('cal.add')}>
        {edit && <EventForm event={edit} settings={settings} today={today} onSave={e => { save(e); setEdit(null) }}
          onDelete={events.some(e => e.id === edit.id) ? () => { remove(edit.id); setEdit(null) } : undefined} />}
      </Sheet>
    </div>
  )
}
