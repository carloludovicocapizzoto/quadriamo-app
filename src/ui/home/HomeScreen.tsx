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
import { SIDE, shown, sizeOf, type WidgetId } from './catalog'
import { WidgetGallery } from './WidgetGallery'
import { useMedia } from '../kit/useMedia'

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
  const wide = useMedia('(min-width: 1280px)'), roomy = useMedia('(min-width: 1024px)')
  const ids = shown(s, roomy)
  const main = wide ? ids.filter(id => !SIDE.includes(id)) : ids
  const side = wide ? ids.filter(id => SIDE.includes(id)) : []
  const [drag, setDrag] = useState<WidgetId | null>(null)
  const [over, setOver] = useState<WidgetId | null>(null)
  const { dispatch } = useStore()
  // trascinato su un altro widget: prende il suo posto (gli altri scorrono)
  const dropOn = (target: WidgetId) => {
    const from = drag
    setDrag(null); setOver(null)
    if (!from || from === target) return
    const list = ids.filter(x => x !== from)
    list.splice(list.indexOf(target), 0, from)
    tap(); dispatch({ type: 'setSettings', settings: { ...s, homeWidgets: list } })
  }
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

  // senza entrate niente da dividere: niente quattro parti a zero (come il numero del giorno)
  const ctx = { data, r, today, streak, parts: hasPlan ? blocks : null, daily: hasPlan ? left : 0, onOpen, onAll }
  // il posto del widget: porta la taglia e, sul computer, si trascina dalla maniglia per cambiare l'ordine
  const slot = (id: WidgetId) => (
    <div key={id} className={`w-slot size-${sizeOf(s, id)}${drag === id ? ' dragging' : ''}${over === id && drag !== id ? ' over' : ''}`}
         draggable={drag === id} onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id) }}
         onDragOver={e => { if (drag) { e.preventDefault(); setOver(id) } }} onDrop={e => { e.preventDefault(); dropOn(id) }} onDragEnd={() => { setDrag(null); setOver(null) }}>
      <button className="w-drag" aria-label={t('hw.drag')} onPointerDown={() => setDrag(id)} onPointerUp={() => setDrag(null)}><Icon name="list" size={16} /></button>
      <Widget id={id} c={ctx} />
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
      {/* la griglia sceglie quante colonne in base allo spazio (telefono 1, tablet 2, computer 3-4);
          sugli schermi larghi le cose "di contorno" (notizie, pagamenti, mercati, eventi) vanno nel pannello a destra */}
      <div className={wide ? 'home-layout' : undefined}>
        <div className="home-grid">{main.map(slot)}</div>
        {wide && side.length > 0 && <aside className="home-side">{side.map(slot)}</aside>}
      </div>
      <button className="link-btn home-edit" onClick={() => { tap(); setEdit(true) }}>{t('hw.edit')}</button>

      <Sheet open={edit} onClose={() => setEdit(false)} title={t('hw.edit')}>{edit && <WidgetGallery ids={ids} ctx={ctx} />}</Sheet>
      <Sheet open={!!part} onClose={() => setPart(null)} title={part ? bucketName(part.bucket, t) : ''}>
        {part && <PartDetail b={part} r={r} cur={cur} color={BUCKET_COLORS[r.buckets.indexOf(part)]} onOpen={tx => { setPart(null); onOpen(tx) }}
                             onAll={() => { setPart(null); onAll() }} settings={s} />}
      </Sheet>
    </div>
  )
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
