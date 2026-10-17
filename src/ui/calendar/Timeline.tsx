// La timeline del calendario: i giorni in colonna, a sinistra la data, a destra cosa succede. È la stessa per la settimana
// sotto il mese, la vista Giorno, la vista Settimana e l'Agenda. Le voci entrano una dopo l'altra (motion: fade-up), le
// scadenze da seguire finché non sono fatte (nag) e già passate dicono "In ritardo", quelle fatte sono barrate.
import type { CSSProperties } from 'react'
import { GOAL_EVENT, KIND_SIDE, parseDate, presetOf, toneOf, type CalEvent } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { Icon } from '../Icon'
import { Monogram } from '../kit/Monogram'
import { Money } from '../kit/Money'
import { tap } from '../kit/motion'

const k = (s: string) => s as keyof Dict
export type Item = { date: string; event: CalEvent; done: boolean }

export function Timeline({ days, byDay, today, selected, currency, compactEmpty, label, onOpen }: {
  days: string[]; byDay: Map<string, Item[]>; today: string; selected?: string; currency: string
  compactEmpty?: boolean            // i giorni senza niente in una riga sottile (settimana sotto il mese)
  label: (e: CalEvent) => string    // tipo, o per gli obiettivi quanto manca
  onOpen: (x: Item) => void
}) {
  const { t, date } = useI18n()
  const repeatLabel = (e: CalEvent) => {
    const p = presetOf(e.repeat)
    return p === 'once' ? null : p === 'custom' && e.repeat ? t('rp.customLine', { n: e.repeat.every, unit: t(k(`unit.${e.repeat.unit}`)) }) : t(k(`rp.${p}`)).toLowerCase()
  }
  return (
    <ol className="tl" key={days[0]}>
      {days.map((d, i) => {
        const list = byDay.get(d) ?? []
        const empty = !list.length
        return (
          <li key={d} className={`tl-day${d === today ? ' today' : ''}${d === selected ? ' on' : ''}${empty ? ' empty' : ''}`}
            style={{ '--i': i } as CSSProperties}>
            <div className="tl-date" aria-label={date(d, { weekday: 'long', day: 'numeric', month: 'long' })}>
              <b>{parseDate(d).day}</b><small>{date(d, { weekday: 'short' })}</small>
            </div>
            {empty ? <p className="tl-none">{compactEmpty ? '' : t('cal.nothing')}</p> : <ul className="tl-items">{list.map(x => {
              const side = KIND_SIDE[x.event.kind]
              const late = !x.done && side === 'out' && x.date < today && !!x.event.nag
              const kind = label(x.event)
              return (
                <li key={x.event.id + x.date}>
                  <button className={`tl-row tone-${toneOf(x.event.kind)}${x.done ? ' done' : ''}`} onClick={() => { tap(); onOpen(x) }}>
                    {x.event.service ? <Monogram service={x.event.service} name={x.event.title} size={26} /> : <span className="tl-dot" aria-hidden="true" />}
                    <span className="tl-main"><span>{x.event.title}</span>
                      <small>{late && <b className="tl-late">{t('cal.overdue')}</b>}
                        {[kind === x.event.title ? null : kind, repeatLabel(x.event), x.done ? t('ev.done') : null].filter(Boolean).join(' · ')}</small></span>
                    {x.event.amount != null && !x.event.id.startsWith(GOAL_EVENT) &&
                      <Money className="tl-amount" value={side === 'in' ? x.event.amount : -x.event.amount} currency={currency} />}
                    {x.done && <Icon name="check" size={16} className="cal-done" />}
                  </button>
                </li>
              )
            })}</ul>}
          </li>
        )
      })}
    </ol>
  )
}
