// Profilo → Abbonamenti → Costo annuale: ogni abbonamento è un blocco grande quanto costa in un anno (treemap).
// Toccando un blocco: al mese, in un anno, categoria, aumenti di prezzo, e "Simula senza": il blocco esce, gli altri si
// ridispongono e in cima compare quanto risparmieresti. È solo una simulazione: niente viene cancellato.
import { useMemo, useState, type CSSProperties } from 'react'
import { nextOccurrence, presetOf, todayIso, treemap, yearlyCost, type CalEvent } from '../../engine'
import { serviceById } from '../../content/services'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { useStore } from '../../store/context'
import { Empty } from '../kit/Empty'
import { Monogram } from '../kit/Monogram'
import { Money } from '../kit/Money'
import { tap } from '../kit/motion'
import { Sheet } from '../kit/Sheet'
import { EventForm } from '../calendar/EventForm'
import { useEvents } from '../calendar/useEvents'
import { categoryName } from '../names'

const k = (s: string) => s as keyof Dict
const HEIGHT = 115   // il riquadro è un po' più alto che largo: su un telefono i blocchi restano comodi da toccare

export function YearCost({ onAdd }: { onAdd: () => void }) {
  const { t, date, money } = useI18n()
  const settings = useStore().state.data!.settings
  const cur = settings.currency
  const { events, save, remove } = useEvents()
  const today = todayIso()
  const [off, setOff] = useState<string[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [edit, setEdit] = useState<CalEvent | null>(null)
  const subs = useMemo(() => events.filter(e => e.kind === 'subscription' && e.active && e.repeat && nextOccurrence(e, today) && yearlyCost(e) > 0), [events, today])
  const kept = subs.filter(e => !off.includes(e.id))
  const total = kept.reduce((a, e) => a + yearlyCost(e), 0)
  const saved = subs.filter(e => off.includes(e.id)).reduce((a, e) => a + yearlyCost(e), 0)
  const tiles = useMemo(() => treemap(kept.map(e => ({ id: e.id, value: yearlyCost(e) })), HEIGHT), [kept])
  const current = subs.find(e => e.id === sel) ?? null

  if (!subs.length) return <Empty title={t('yc.emptyTitle')} text={t('yc.emptyText')} action={{ label: t('sub.add'), onClick: onAdd }} />

  const toggle = (id: string) => { tap(); setOff(o => o.includes(id) ? o.filter(x => x !== id) : [...o, id]); setSel(null) }
  const catLabel = (e: CalEvent) => {
    const s = serviceById(e.service)
    if (s) return t(k(`sub.cat.${s.category}`))
    const c = settings.categories.find(c => c.id === e.category)
    return c ? categoryName(c, t) : t('ev.noBudget')
  }

  return (
    <div className="yc">
      <section className="yc-head">
        <p className="cs-label">{off.length ? t('yc.withChoices') : t('sub.yearTotal')}</p>
        <Money className="cs-hero" value={total} currency={cur} />
        <p className="muted small">{t('yc.line', { month: money(total / 12, cur), n: kept.length })}</p>
        {saved > 0 && <p className="yc-saved">{off.length === 1 ? t('yc.savedOne', { amount: money(saved, cur), name: subs.find(e => e.id === off[0])?.title ?? '' }) : t('yc.saved', { amount: money(saved, cur), n: off.length })}
          <button className="link-btn" onClick={() => { tap(); setOff([]) }}>{t('yc.reset')}</button></p>}
      </section>

      <div className="yc-map" style={{ aspectRatio: `100 / ${HEIGHT}` }} role="list" aria-label={t('yc.title')}>
        {tiles.map(tile => {
          const e = subs.find(x => x.id === tile.id)!
          const s = serviceById(e.service)
          const small = tile.w < 22 || tile.h < 16, mid = !small && tile.h < 27   // nei blocchi bassi solo sigla e cifra
          return <button key={tile.id} role="listitem" className={`yc-tile${small ? ' small' : mid ? ' mid' : ''}`} onClick={() => { tap(); setSel(e.id) }}
            aria-label={`${e.title}, ${money(yearlyCost(e), cur)}`}
            style={{ left: `${tile.x}%`, top: `${(tile.y / HEIGHT) * 100}%`, width: `${tile.w}%`, height: `${(tile.h / HEIGHT) * 100}%`,
              ...(s ? { '--c': s.color } : {}) } as CSSProperties}>
            <span className="yc-in">
              <Monogram service={e.service} name={e.title} size={small ? 22 : 28} />
              {!small && <><b>{e.title}</b><small><Money value={yearlyCost(e)} currency={cur} /></small></>}
            </span>
          </button>
        })}
      </div>
      <p className="group-foot">{t('yc.foot')}</p>

      {off.length > 0 && <section className="group">
        <h2 className="group-title">{t('yc.without')}</h2>
        <ul className="group-list">{subs.filter(e => off.includes(e.id)).map(e => (
          <li key={e.id}><button className="row" onClick={() => toggle(e.id)}>
            <Monogram service={e.service} name={e.title} size={30} />
            <span className="row-main"><span>{e.title}</span><small>{t('yc.putBack')}</small></span>
            <span className="row-value good-text">+<Money value={yearlyCost(e)} currency={cur} /></span>
          </button></li>))}
        </ul>
      </section>}

      <Sheet open={!!current} onClose={() => setSel(null)}>
        {current && <div className="event-detail">
          <div className="yc-detail-head"><Monogram service={current.service} name={current.title} size={44} />
            <div><p className="eyebrow-small">{catLabel(current)}</p><h2>{current.title}</h2></div></div>
          <ul className="ed-facts">
            <li><span>{t('yc.perMonth')}</span><b>{money(yearlyCost(current) / 12, cur)}</b></li>
            <li><span>{t('ev.yearly')}</span><b>{money(yearlyCost(current), cur)}</b></li>
            <li><span>{t('ev.repeat')}</span><b>{t(k(`rp.${presetOf(current.repeat)}`))} · {money(current.amount ?? 0, cur)}</b></li>
            {(current.prices ?? []).slice().reverse().map(p => <li key={p.date + p.to}><span>{date(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <b>{money(p.from, cur)} → {money(p.to, cur)}{p.from > 0 && <small className={p.to > p.from ? 'subs-up' : 'good-text'}> {p.to > p.from ? '+' : ''}{Math.round((p.to / p.from - 1) * 100)}%</small>}</b></li>)}
          </ul>
          <p className="yc-sim">{t('yc.wouldSave', { amount: money(yearlyCost(current), cur) })}</p>
          <button className="btn primary wide" onClick={() => toggle(current.id)}>{t('yc.simulate')}</button>
          <button className="btn wide top-gap" onClick={() => { tap(); setEdit(current); setSel(null) }}>{t('ev.edit')}</button>
        </div>}
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={t('ev.edit')}>
        {edit && <EventForm event={edit} settings={settings} today={today} onSave={e => { save(e); setEdit(null) }} onDelete={() => { remove(edit.id); setEdit(null) }} />}
      </Sheet>
    </div>
  )
}
