// Analisi → Calendario: quello che succederà ai tuoi soldi. Quattro viste (giorno, settimana, mese, agenda), un punto per
// ogni scadenza nel mese (scuro le uscite, verde le entrate, grigio i promemoria), e il dettaglio di ogni voce.
import { useMemo, useState } from 'react'
import { GOAL_EVENT, KIND_SIDE, addDays, agenda, goalEvents, goalStatus, daysBetween, makeDate, parseDate, presetOf, type CalEvent, type Settings } from '../../engine'
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
import { blankEvent, useEvents } from './useEvents'

type Mode = 'day' | 'week' | 'month' | 'agenda'
const MODES: Mode[] = ['day', 'week', 'month', 'agenda']
const MODE_KEY = 'q.calMode'
const k = (s: string) => s as keyof Dict
const AGENDA_DAYS = 60

/** Il lunedì della settimana di `iso`. */
const monday = (iso: string) => addDays(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7))

export function CalendarView({ settings, today }: { settings: Settings; today: string }) {
  const { t, date, lang, money } = useI18n()
  const { events: own, save, remove, toggleDone } = useEvents()
  // con le scadenze degli obiettivi (si toccano per aprire l'obiettivo)
  const goals = useStore().state.data?.goals
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
  const items = useMemo(() => agenda(events, from, to), [events, from, to])
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

  const totals = (list: typeof items) => list.filter(x => !x.done && x.event.amount).reduce((a, x) => {
    const side = KIND_SIDE[x.event.kind]
    if (side === 'out') a.out += x.event.amount!; else if (side === 'in') a.in += x.event.amount!
    return a
  }, { out: 0, in: 0 })

  const kindLabel = (e: CalEvent) => {
    if (!e.id.startsWith(GOAL_EVENT)) return t(k(`ev.kind.${e.kind}`))
    const g = goals?.find(x => GOAL_EVENT + x.id === e.id)
    return g ? t('cal.goalLeft', { amount: money(goalStatus(g, today).left, cur) }) : ''
  }
  const repeatLabel = (e: CalEvent) => {
    const p = presetOf(e.repeat)
    return p === 'once' ? null : p === 'custom' && e.repeat ? t('rp.customLine', { n: e.repeat.every, unit: t(k(`unit.${e.repeat.unit}`)) }) : t(k(`rp.${p}`)).toLowerCase()
  }
  const row = (x: (typeof items)[number], showDate = false) => {
    const side = KIND_SIDE[x.event.kind]
    return (
      <li key={x.event.id + x.date}><button className={`row cal-row side-${side}${x.done ? ' done' : ''}`} onClick={() => { tap(); if (x.event.id.startsWith(GOAL_EVENT)) navigate({ tab: 'profile', page: 'goals' }); else setOpen({ event: x.event, date: x.date }) }}>
        <span className="cal-dot" aria-hidden="true" />
        <span className="row-main"><span>{x.event.title}</span>
          <small>{[showDate ? date(x.date, { weekday: 'short', day: 'numeric', month: 'short' }) : null,
            kindLabel(x.event) === x.event.title ? null : kindLabel(x.event), repeatLabel(x.event), x.done ? t('ev.done') : null].filter(Boolean).join(' · ')}</small></span>
        {x.event.amount != null && <span className="row-value"><Money value={side === 'in' ? x.event.amount : -x.event.amount} currency={cur} /></span>}
        {x.done && <Icon name="check" size={16} className="cal-done" />}
      </button></li>
    )
  }

  if (!events.length) return <>
    <Empty title={t('cal.emptyTitle')} text={t('cal.emptyText')} action={{ label: t('cal.add'), onClick: () => setEdit(blankEvent(today)) }} />
    <Sheet open={!!edit} onClose={() => setEdit(null)} title={t('cal.add')}>
      {edit && <EventForm event={edit} settings={settings} today={today} onSave={e => { save(e); setEdit(null) }} />}
    </Sheet>
  </>

  const dayList = byDay.get(day) ?? []
  const sum = totals(mode === 'month' ? items.filter(x => x.date.slice(0, 7) === day.slice(0, 7)) : items)
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

      {(sum.out > 0 || sum.in > 0) && <dl className="cal-sum">
        {sum.out > 0 && <div><dt>{t('cal.out')}</dt><dd><Money value={sum.out} currency={cur} /></dd></div>}
        {sum.in > 0 && <div><dt>{t('cal.in')}</dt><dd><Money value={sum.in} currency={cur} /></dd></div>}
      </dl>}

      {mode === 'month' && <div className="cal-month" role="grid" aria-label={title}>
        {weekdays.map((w, i) => <span key={i} className="cal-wd" aria-hidden="true">{w}</span>)}
        {Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i)).map(d => {
          const list = byDay.get(d) ?? []
          const sides = [...new Set(list.map(x => KIND_SIDE[x.event.kind]))]
          const outside = d.slice(0, 7) !== day.slice(0, 7)
          return <button key={d} role="gridcell" aria-selected={d === day} aria-label={`${date(d, { day: 'numeric', month: 'long' })}${list.length ? `, ${list.length}` : ''}`}
            className={`cal-day${d === day ? ' on' : ''}${d === today ? ' today' : ''}${outside ? ' out' : ''}`} onClick={() => { tap(); setDay(d) }}>
            <span>{parseDate(d).day}</span>
            <i className="cal-dots" aria-hidden="true">{sides.map(sd => <b key={sd} className={`side-${sd}`} />)}</i>
          </button>
        })}
      </div>}

      {mode === 'month' || mode === 'day' ? <>
        {mode === 'month' && <p className="day-label">{date(day, { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
        {dayList.length ? <ul className="group-list cal-list">{dayList.map(x => row(x))}</ul> : <p className="muted small cal-none">{t('cal.nothing')}</p>}
      </> : mode === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(from, i)).map(d => (
        <section key={d} className="cal-group">
          <p className={`day-label${d === today ? ' today' : ''}`}>{date(d, { weekday: 'long', day: 'numeric' })}</p>
          {(byDay.get(d) ?? []).length ? <ul className="group-list cal-list">{byDay.get(d)!.map(x => row(x))}</ul> : <p className="muted small cal-none">—</p>}
        </section>
      )) : items.length ? <ul className="group-list cal-list">{items.map(x => row(x, true))}</ul> : <p className="muted small cal-none">{t('cal.nothingAgenda', { n: AGENDA_DAYS })}</p>}

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
