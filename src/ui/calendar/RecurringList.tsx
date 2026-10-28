// Profilo → Abbonamenti e ricorrenti (e il passaggio della configurazione iniziale): gli eventi del calendario che si
// ripetono e fanno uscire soldi. In cima gli abbonamenti, con quanto costano in un anno, il rinnovo, come li paghi e gli
// aumenti di prezzo; sotto gli altri pagamenti fissi (affitto, rate, bollette). Sono gli stessi eventi del calendario.
import { useState } from 'react'
import { KIND_SIDE, daysBetween, nextOccurrence, presetOf, recentIncrease, remainingCount, todayIso, yearlyCost, type CalEvent } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { navigate } from '../../app/router'
import { useStore } from '../../store/context'
import { Icon } from '../Icon'
import { AddRow } from '../kit/List'
import { Monogram } from '../kit/Monogram'
import { Money } from '../kit/Money'
import { tap } from '../kit/motion'
import { Sheet } from '../kit/Sheet'
import { ServicePicker } from '../subs/ServicePicker'
import { EventForm } from './EventForm'
import { blankEvent, useEvents } from './useEvents'

const k = (s: string) => s as keyof Dict

export function RecurringList() {
  const { t, date, money } = useI18n()
  const { state } = useStore()
  const settings = state.data!.settings
  const cur = settings.currency
  const { events, save, remove } = useEvents()
  const [edit, setEdit] = useState<CalEvent | null>(null)
  const [picking, setPicking] = useState(false)
  const today = todayIso()
  const withNext = (list: CalEvent[]) => list.map(e => ({ e, next: nextOccurrence(e, today), left: remainingCount(e, today) }))
    .sort((a, b) => (a.next ?? '9').localeCompare(b.next ?? '9'))
  const subs = withNext(events.filter(e => e.kind === 'subscription' && e.repeat))
  const others = withNext(events.filter(e => e.kind !== 'subscription' && e.repeat && KIND_SIDE[e.kind] === 'out'))
  const yearly = subs.filter(x => x.e.active && x.next).reduce((a, x) => a + yearlyCost(x.e), 0)
  const isNew = edit && !events.some(e => e.id === edit.id)
  const when = (next: string | null) => {
    if (!next) return t('rec.ended')
    const n = daysBetween(today, next)
    return n === 0 ? t('sub.renewToday') : n === 1 ? t('sub.renewTomorrow') : n <= 7 ? t('sub.renewIn', { n }) : t('rec.next', { date: date(next, { day: 'numeric', month: 'short' }) })
  }
  const cycle = (e: CalEvent) => t(k(`rp.${presetOf(e.repeat)}`))
  const recurringMeta = (e: CalEvent, next: string | null, left: number | null) => [
    cycle(e),
    ...(e.kind === 'bill' ? [t('ev.estimateTag')] : []),
    next ? t('rec.next', { date: date(next, { day: 'numeric', month: 'short' }) }) : t('rec.ended'),
    ...(left != null && left > 0 ? [t('ev.left', { n: left })] : []),
    ...(e.until ? [t('rec.last', { date: date(e.until, { day: 'numeric', month: 'short', year: 'numeric' }) })] : []),
  ].join(' · ')

  return <>
    {subs.length > 0 && <section className="subs-head">
      <p className="cs-label">{t('sub.yearTotal')}</p>
      <Money className="cs-hero" value={yearly} currency={cur} />
      <p className="muted small">{subs.length === 1 ? t('sub.yearLineOne', { month: money(yearly / 12, cur) }) : t('sub.yearLine', { month: money(yearly / 12, cur), n: subs.length })}</p>
      <button className="link-btn" onClick={() => { tap(); navigate({ tab: 'profile', page: 'yearCost' }) }}>{t('yc.open')} →</button>
    </section>}

    <section className="group">
      <h2 className="group-title">{t('sub.title')}</h2>
      {!subs.length && <p className="muted small group-intro">{t('sub.empty')}</p>}
      <ul className="group-list subs-list">{subs.map(({ e, next }) => {
        const up = recentIncrease(e, today)
        return <li key={e.id}><button className={`row${e.active ? '' : ' muted'}`} onClick={() => { tap(); setEdit(e) }}>
          <Monogram service={e.service} name={e.title} size={38} />
          <span className="row-main"><span>{e.title}</span>
            <small>{[cycle(e), when(next), e.method ? t(k(`pm.${e.method}`)) : null].filter(Boolean).join(' · ')}</small></span>
          <span className="row-value subs-price">{e.amount != null && <Money value={e.amount} currency={cur} />}
            {up != null && <small className="subs-up">+{up}%</small>}</span>
          <Icon name="chevron" size={18} className="row-chev" />
        </button></li>
      })}
        <AddRow label={t('sub.add')} onClick={() => setPicking(true)} />
      </ul>
    </section>

    <section className="group">
      <h2 className="group-title">{t('rec.others')}</h2>
      <p className="muted small group-intro">{t('rec.hint')}</p>
      <ul className="group-list">{others.map(({ e, next, left }) => (
        <li key={e.id}><button className={`row${e.active ? '' : ' muted'}`} onClick={() => { tap(); setEdit(e) }}>
          <span className="row-main"><span>{e.title}</span>
            <small>{recurringMeta(e, next, left)}</small>
            {e.kind === 'bill' && e.amount != null && e.amount > 0 && <small>{t('ev.estimateLine', { month: money(yearlyCost(e) / 12, cur), year: money(yearlyCost(e), cur) })}</small>}</span>
          {e.amount != null && <span className="row-value"><Money value={e.amount} currency={cur} /></span>}
          <Icon name="chevron" size={18} className="row-chev" />
        </button></li>))}
        <AddRow label={t('rec.add')} onClick={() => setEdit(blankEvent(today))} />
      </ul>
    </section>

    <Sheet open={picking} onClose={() => setPicking(false)} title={t('sub.add')}>
      {picking && <ServicePicker onPick={(s, name) => {
        setPicking(false)
        setEdit(blankEvent(today, { kind: 'subscription', title: name.slice(0, 60), service: s?.id ?? null, category: 'fixedCosts',
          repeat: s?.yearly ? { every: 1, unit: 'year' } : { every: 1, unit: 'month' } }))
      }} />}
    </Sheet>
    <Sheet open={!!edit} onClose={() => setEdit(null)} title={isNew ? (edit?.kind === 'subscription' ? t('sub.add') : t('rec.add')) : t('ev.edit')}>
      {edit && <EventForm event={edit} settings={settings} today={today} focusAmount={!!isNew && !!edit.title}
        onSave={e => { save(e); setEdit(null) }} onDelete={isNew ? undefined : () => { remove(edit.id); setEdit(null) }} />}
    </Sheet>
  </>
}

