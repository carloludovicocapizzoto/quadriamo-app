import { useMemo, useState } from 'react'
import { daysBetween, todayBudget, type BucketRow, type ClassifiedTx, type MonthResult, type Streak } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { AppData } from '../../store/state'
import { Icon } from '../Icon'
import { tap, useCountUp } from '../kit/motion'
import { Money } from '../kit/Money'
import { Meter } from '../kit/Meter'
import { Empty } from '../kit/Empty'
import { Outcome } from '../Outcome'
import { Sheet } from '../kit/Sheet'
import { BUCKET_COLORS, bucketName } from '../names'
import { TxRow } from '../TxRow'
import { useStore } from '../../store/context'
import { Widget } from './widgets'
import { DEFAULT_WIDGETS, WIDGETS, shown, type WidgetId } from './catalog'

/**
 * Home: prima la domanda "quanto posso spendere oggi?" (il numero del giorno è il protagonista),
 * poi i widget che l'utente sceglie e ordina (quattro parti, oggi, fine mese, grafici, obiettivi, slancio).
 */
export function HomeScreen({ data, r, today, streak, onAdd, onOpen, onAll }: {
  data: AppData; r: MonthResult; today: string; streak: Streak | null
  onAdd: (kind: 'expense' | 'income') => void; onOpen: (tx: ClassifiedTx) => void; onAll: () => void
}) {
  const { t, date } = useI18n()
  const s = data.settings, cur = s.currency
  const budget = useMemo(() => todayBudget(r, s, today), [r, s, today])
  const [part, setPart] = useState<BucketRow | null>(null)
  const [edit, setEdit] = useState(false)
  const left = useCountUp(budget.left)
  const daysLeft = daysBetween(today, r.period.end) + 1
  const hasPlan = budget.parts.length > 0 && r.income > 0
  const day = date(today, { weekday: 'long', day: 'numeric', month: 'long' })

  // i quattro blocchi: vivono qui perché aprono il dettaglio della parte
  const blocks = (
    <div className="blocks">
        {r.buckets.map((b, i) => {
          const rest = b.available > 0 ? Math.max(0, Math.min(1, b.remaining / b.available)) : 0
          return (
            <button key={b.bucket.id} className={`block${b.remaining < 0 ? ' over' : ''}`} style={{ ['--bc' as string]: BUCKET_COLORS[i] }}
                    onClick={() => { tap(); setPart(b) }}>
              <span className="block-shape" aria-hidden="true"><span style={{ transform: `scaleY(${rest})` }} /></span>
              <Money className="block-amount" value={b.remaining} currency={cur} bare />
              <span className="block-name">{bucketName(b.bucket, t)}</span>
            </button>
          )
        })}
      </div>
  )

  return (
    <div className="home">
      <p className="home-date">{day.charAt(0).toUpperCase() + day.slice(1)}</p>

      {/* senza entrate non c'è niente da dividere: solo il primo passo, niente blocchi vuoti e zeri */}
      {!hasPlan ? <Empty title={t('home.emptyTitle')} text={t('home.noSalary')} action={{ label: t('home.addSalary'), onClick: () => onAdd('income') }} />
      : <section className="hero" aria-live="polite">
        <Money className="hero-amount" value={left} currency={cur} />
        <p className="hero-sub">{daysLeft > 1 ? t('home.heroSub', { n: daysLeft }) : t('home.heroLast')}</p>
      </section>}

      {/* i widget scelti, in ordine; quelli del mese compaiono quando ci sono le entrate */}
      {shown(s).map(id => <Widget key={id} id={id} c={{ data, r, today, streak, parts: blocks, onOpen, onAll }} />)}
      <button className="link-btn home-edit" onClick={() => { tap(); setEdit(true) }}>{t('hw.edit')}</button>

      <Sheet open={edit} onClose={() => setEdit(false)} title={t('hw.edit')}>{edit && <HomeEditor />}</Sheet>
      <Sheet open={!!part} onClose={() => setPart(null)} title={part ? bucketName(part.bucket, t) : ''}>
        {part && <PartDetail b={part} r={r} cur={cur} color={BUCKET_COLORS[r.buckets.indexOf(part)]} onOpen={tx => { setPart(null); onOpen(tx) }}
                             onAll={() => { setPart(null); onAll() }} settings={s} />}
      </Sheet>
    </div>
  )
}

/** Personalizza la Home: accendi o spegni ogni widget e spostalo su o giù. Si salva nelle impostazioni (sincronizzate). */
function HomeEditor() {
  const { t } = useI18n()
  const { state, dispatch } = useStore()
  const settings = state.data!.settings
  const on = shown(settings)
  // prima quelli accesi, nel loro ordine; poi gli altri
  const list: WidgetId[] = [...on, ...WIDGETS.filter(w => !on.includes(w))]
  const save = (next: WidgetId[]) => dispatch({ type: 'setSettings', settings: { ...settings, homeWidgets: next } })
  const move = (id: WidgetId, d: -1 | 1) => {
    const i = on.indexOf(id), j = i + d
    if (i < 0 || j < 0 || j >= on.length) return
    const next = [...on]; [next[i], next[j]] = [next[j], next[i]]; tap(); save(next)
  }
  return <>
    <ul className="group-list home-editor">{list.map(id => {
      const active = on.includes(id), i = on.indexOf(id)
      return <li key={id}><div className="row">
        <span className="row-main"><span>{t(`hw.${id}` as 'hw.parts')}</span><small>{t(`hw.${id}D` as 'hw.partsD')}</small></span>
        {active && <>
          <button className="icon-btn ghost" disabled={i === 0} onClick={() => move(id, -1)} aria-label={t('hw.up')}><Icon name="chevron" size={18} className="rot-up" /></button>
          <button className="icon-btn ghost" disabled={i === on.length - 1} onClick={() => move(id, 1)} aria-label={t('hw.down')}><Icon name="chevron" size={18} className="rot-down" /></button>
        </>}
        <button type="button" role="switch" aria-checked={active} aria-label={t(`hw.${id}` as 'hw.parts')} className={`switch${active ? ' on' : ''}`}
          onClick={() => { tap(); save(active ? on.filter(x => x !== id) : [...on, id]) }}><i /></button>
      </div></li>
    })}</ul>
    <button className="link-btn top-gap" onClick={() => { tap(); save(DEFAULT_WIDGETS) }}>{t('hw.reset')}</button>
  </>
}

function PartDetail({ b, r, cur, color, settings, onOpen, onAll }: {
  b: BucketRow; r: MonthResult; cur: string; color: string; settings: AppData['settings']; onOpen: (tx: ClassifiedTx) => void; onAll: () => void
}) {
  const { t, money } = useI18n()
  const used = b.available > 0 ? Math.max(0, Math.min(1, 1 - b.remaining / b.available)) : 0
  const txs = (r.spendingByBucket[b.bucket.id] ?? []).filter(x => !x.upcoming).slice(-6).reverse()
  return <>
    {/* quanto rimane è il protagonista; la linea si riempie con quanto hai speso, nel colore della parte */}
    <Outcome value={b.remaining} currency={cur} label={t(b.remaining < 0 ? 'part.over' : 'part.leftOf', { amount: money(b.available, cur) })}
      totals={[{ label: t('bucket.spent'), value: b.spent }, { label: t('part.used'), value: `${Math.round(used * 100)}%` }]}>
      <Meter value={used} color={color} label={t('part.used')} />
    </Outcome>
    <p className="day-label">{t('part.last')}</p>
    {txs.length ? <ul className="tx-list">{txs.map(tx => <TxRow key={tx.id} tx={tx} settings={settings} onOpen={onOpen} />)}</ul>
      : <p className="muted small">{t('month.noSpending')}</p>}
    <button className="btn wide top-gap" onClick={onAll}>{t('w.seeAll')}</button>
  </>
}
