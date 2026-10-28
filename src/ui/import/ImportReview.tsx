// Prima di importare un estratto: se il file è ambiguo si sceglie come sono scritti numeri e date (con un esempio letto
// nei due modi), poi si vede il riepilogo (periodo, nuovi, già importati, righe escluse con il motivo, entrate e uscite).
// Niente entra nella casella «Da confermare» finché non si conferma qui.
import { useMemo, useState } from 'react'
import { parseDateWith, parseMoney, readStatement, type DateOrder, type DecimalMark, type StatementOptions } from '../../engine'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { planImport, type AppData, type InboxItem } from '../../store/state'
import { Icon } from '../Icon'
import { Group, Row } from '../kit/List'

const k = (s: string) => s as keyof Dict
const MARKS: DecimalMark[] = [',', '.']
const ORDERS: DateOrder[] = ['dmy', 'mdy']
const SHOWN_SKIPPED = 20

export function ImportReview({ text, data, onDone, onClose }: {
  text: string; data: AppData; onDone: (items: InboxItem[], duplicates: number) => void; onClose: () => void
}) {
  const { t, money, date } = useI18n()
  const [opts, setOpts] = useState<StatementOptions>({})
  const [draft, setDraft] = useState<StatementOptions>({})
  const res = useMemo(() => readStatement(text, undefined, opts), [text, opts])
  const plan = useMemo(() => planImport(data, res.rows), [data, res.rows])
  const cur = data.settings.currency
  const long = (iso: string) => date(iso, { day: 'numeric', month: 'short', year: 'numeric' })

  if (res.needs) {
    const { number, date: dates } = res.needs
    const ready = (!number || draft.mark) && (!dates || draft.order)
    const choice = (on: boolean, label: string, detail: string, pick: () => void) => (
      <li><button type="button" className="row" role="radio" aria-checked={on} onClick={pick}>
        <span className="row-main"><span>{label}</span><small>{detail}</small></span>
        {on && <Icon name="check" size={18} className="row-check" />}
      </button></li>
    )
    return <div className="import-review">
      {number && <section className="group">
        <h2 className="group-title">{t('imp.numbers')}</h2>
        <p className="muted small group-intro">{number.conflicting ? t('imp.numberConflict') : t('imp.numberAsk', { sample: number.samples[0] ?? '' })}</p>
        <ul className="group-list" role="radiogroup" aria-label={t('imp.numbers')}>
          {MARKS.map(m => choice(draft.mark === m, t(m === ',' ? 'imp.markComma' : 'imp.markDot'),
            number.samples.map(s => { const r = parseMoney(s, m); return `${s} → ${r.ok ? money(r.value, cur) : t('imp.invalid')}` }).join(' · '),
            () => setDraft(d => ({ ...d, mark: m }))))}
        </ul>
      </section>}
      {dates && <section className="group">
        <h2 className="group-title">{t('imp.dates')}</h2>
        <p className="muted small group-intro">{dates.conflicting ? t('imp.dateConflict') : t('imp.dateAsk', { sample: dates.samples[0] ?? '' })}</p>
        <ul className="group-list" role="radiogroup" aria-label={t('imp.dates')}>
          {ORDERS.map(o => choice(draft.order === o, t(k(`imp.${o}`)),
            dates.samples.map(s => { const d = parseDateWith(s, o); return `${s} → ${d ? long(d) : t('imp.invalid')}` }).join(' · '),
            () => setDraft(d => ({ ...d, order: o }))))}
        </ul>
      </section>}
      <div className="form-end cat-end">
        <button type="button" className="link-btn" onClick={onClose}>{t('imp.previewCancel')}</button>
        <button type="button" className="btn primary" disabled={!ready} onClick={() => setOpts(draft)}>{t('imp.continue')}</button>
      </div>
    </div>
  }

  const dates = res.rows.map(r => r.date).sort()
  const base = plan.items.filter(i => !i.currency)
  const income = base.filter(i => i.amount > 0).reduce((a, i) => a + i.amount, 0)
  const spent = base.filter(i => i.amount < 0).reduce((a, i) => a - i.amount, 0)
  return <div className="import-review">
    <Group>
      {dates.length > 0 && <Row label={t('imp.periodShort')} value={`${long(dates[0])} – ${long(dates.at(-1)!)}`} />}
      <Row label={t('imp.rowsNew')} value={String(plan.items.length)} />
      {plan.duplicates > 0 && <Row label={t('imp.rowsDup')} detail={t('imp.rowsDupHint')} value={String(plan.duplicates)} />}
      {res.skipped.length > 0 && <Row label={t('imp.rowsSkipped')} detail={t('imp.rowsSkippedHint')} value={String(res.skipped.length)} />}
      {income > 0 && <Row label={t('imp.totalIn')} value={money(income, cur)} />}
      {spent > 0 && <Row label={t('imp.totalOut')} value={money(-spent, cur)} />}
      {res.mark && <Row label={t('imp.numbers')} value={t(res.mark === ',' ? 'imp.markCommaShort' : 'imp.markDotShort')} />}
      {res.order && <Row label={t('imp.dates')} value={t(k(`imp.${res.order}`))} />}
    </Group>
    {res.skipped.length > 0 && <ul className="import-skipped small" aria-label={t('imp.rowsSkipped')}>
      {res.skipped.slice(0, SHOWN_SKIPPED).map(s => <li key={s.line}>{t('imp.line', { n: s.line })} · {t(k(`imp.reason.${s.reason}`))}</li>)}
      {res.skipped.length > SHOWN_SKIPPED && <li>{t('imp.moreSkipped', { n: res.skipped.length - SHOWN_SKIPPED })}</li>}
    </ul>}
    <div className="form-end cat-end">
      <button type="button" className="link-btn" onClick={onClose}>{t('imp.previewCancel')}</button>
      <button type="button" className="btn primary" disabled={!plan.items.length} onClick={() => onDone(plan.items, plan.duplicates)}>
        {plan.items.length === 1 ? t('imp.confirmOne') : t('imp.confirmN', { n: plan.items.length })}</button>
    </div>
  </div>
}
