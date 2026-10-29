// Prima di importare un estratto, nell'ordine e solo se serve:
// 1. il foglio (Excel con più fogli); 2. le colonne (formato non riconosciuto: si indicano a mano, e il telefono le ricorda);
// 3. come sono scritti numeri e date (file ambiguo: con un esempio letto nei due modi); 4. il riepilogo.
// Niente entra nella casella «Da confermare» finché non si conferma qui.
import { useMemo, useState, type ReactNode } from 'react'
import { CSV_LIMITS, detectColumns, parseCsv, parseDateWith, parseMoney, readStatement, type ColumnMap, type DateOrder, type DecimalMark, type StatementOptions } from '../../engine'
import type { WorkbookSheet } from '../../engine/workbook'
import { useI18n } from '../../i18n/core'
import type { Dict } from '../../i18n/en'
import { planImport, type AppData, type InboxItem } from '../../store/state'
import { Icon } from '../Icon'
import { Group, Row } from '../kit/List'
import { saveColumns, savedColumns } from './columnMemory'

const k = (s: string) => s as keyof Dict
const MARKS: DecimalMark[] = [',', '.']
const ORDERS: DateOrder[] = ['dmy', 'mdy']
const SHOWN_SKIPPED = 20
const recognized = (csv: string) => parseCsv(csv).slice(0, 30).some(r => detectColumns(r) != null)

export function ImportReview({ sheets, data, onDone, onClose }: {
  sheets: WorkbookSheet[]; data: AppData; onDone: (items: InboxItem[], duplicates: number) => void; onClose: () => void
}) {
  const { t } = useI18n()
  // un foglio solo, o uno solo con colonne riconosciute: si parte da quello; altrimenti si sceglie
  const [sheet, setSheet] = useState<number | null>(() => {
    if (sheets.length === 1) return 0
    const known = sheets.flatMap((s, i) => (recognized(s.csv) ? [i] : []))
    return known.length === 1 ? known[0] : null
  })
  if (sheet == null) return <div className="import-review">
    <section className="group">
      <h2 className="group-title">{t('imp.sheetTitle')}</h2>
      <ul className="group-list">{sheets.map((s, i) => <li key={i}><button type="button" className="row" onClick={() => setSheet(i)}>
        <span className="row-main"><span>{s.name}</span><small>{t(recognized(s.csv) ? 'imp.sheetFound' : 'imp.sheetUnknown')}</small></span>
        <Icon name="chevron" size={18} className="row-chev" /></button></li>)}</ul>
    </section>
    <div className="form-end"><button type="button" className="link-btn" onClick={onClose}>{t('imp.previewCancel')}</button></div>
  </div>
  return <SheetReview key={sheet} csv={sheets[sheet].csv} data={data} onDone={onDone} onClose={onClose} />
}

function SheetReview({ csv, data, onDone, onClose }: { csv: string; data: AppData; onDone: (items: InboxItem[], duplicates: number) => void; onClose: () => void }) {
  const { t, money, date, lang } = useI18n()
  const auto = useMemo(() => readStatement(csv), [csv])
  const [map, setMap] = useState<ColumnMap | undefined>(() => (auto.map ? undefined : savedColumns(auto.header) ?? undefined))
  const [mapping, setMapping] = useState(false)
  const [opts, setOpts] = useState<StatementOptions>({})
  const res = useMemo(() => readStatement(csv, map, opts), [csv, map, opts])
  const plan = useMemo(() => planImport(data, res.rows), [data, res.rows])
  const cur = data.settings.currency
  const long = (iso: string) => date(iso, { day: 'numeric', month: 'short', year: 'numeric' })
  const cancel = <button type="button" className="link-btn" onClick={onClose}>{t('imp.previewCancel')}</button>

  if (res.error === 'too_large') return <div className="import-review">
    <p className="bad-text small" role="status">{t('imp.tooLarge', { mb: String(CSV_LIMITS.bytes / 1024 / 1024), rows: (CSV_LIMITS.records - 1).toLocaleString(lang), cols: String(CSV_LIMITS.columns) })}</p>
    <div className="form-end">{cancel}</div>
  </div>
  if (!res.map || mapping) return <Columns header={res.header} initial={res.map ?? map ?? null} onCancel={onClose}
    onDone={m => { saveColumns(res.header, m); setMap(m); setOpts({}); setMapping(false) }} />
  if (res.needs) return <Formats needs={res.needs} cur={cur} cancel={cancel} onDone={setOpts} />

  const dates = res.rows.map(r => r.date).sort()
  const base = plan.items.filter(i => !i.currency)
  const toCheck = plan.items.filter(i => i.maybeImported).length
  const income = base.filter(i => i.amount > 0).reduce((a, i) => a + i.amount, 0)
  const spent = base.filter(i => i.amount < 0).reduce((a, i) => a - i.amount, 0)
  return <div className="import-review">
    <Group>
      {dates.length > 0 && <Row label={t('imp.periodShort')} value={`${long(dates[0])} – ${long(dates.at(-1)!)}`} />}
      <Row label={t('imp.rowsNew')} value={String(plan.items.length)} />
      {plan.duplicates > 0 && <Row label={t('imp.rowsDup')} detail={t('imp.rowsDupHint')} value={String(plan.duplicates)} />}
      {toCheck > 0 && <Row label={t('imp.rowsCheck')} detail={t('imp.rowsCheckHint')} value={String(toCheck)} />}
      {res.skipped.length > 0 && <Row label={t('imp.rowsSkipped')} detail={t('imp.rowsSkippedHint')} value={String(res.skipped.length)} />}
      {income > 0 && <Row label={t('imp.totalIn')} value={money(income, cur)} />}
      {spent > 0 && <Row label={t('imp.totalOut')} value={money(-spent, cur)} />}
      {res.mark && <Row label={t('imp.numbers')} value={t(res.mark === ',' ? 'imp.markCommaShort' : 'imp.markDotShort')} />}
      {res.order && <Row label={t('imp.dates')} value={t(k(`imp.${res.order}`))} />}
      <Row label={t('imp.columns')} value={t(map ? 'imp.columnsManual' : 'imp.columnsAuto')} onClick={() => setMapping(true)} />
    </Group>
    {res.skipped.length > 0 && <ul className="import-skipped small" aria-label={t('imp.rowsSkipped')}>
      {res.skipped.slice(0, SHOWN_SKIPPED).map(s => <li key={s.line}>{t('imp.line', { n: s.line })} · {t(k(`imp.reason.${s.reason}`))}</li>)}
      {res.skipped.length > SHOWN_SKIPPED && <li>{t('imp.moreSkipped', { n: res.skipped.length - SHOWN_SKIPPED })}</li>}
    </ul>}
    <div className="form-end cat-end">
      {cancel}
      <button type="button" className="btn primary" disabled={!plan.items.length} onClick={() => onDone(plan.items, plan.duplicates)}>
        {plan.items.length === 1 ? t('imp.confirmOne') : t('imp.confirmN', { n: plan.items.length })}</button>
    </div>
  </div>
}

/** Colonne indicate a mano: data, descrizione e importo con segno (oppure uscite/entrate separate) sono obbligatori. */
function Columns({ header, initial, onDone, onCancel }: { header: string[]; initial: ColumnMap | null; onDone: (m: ColumnMap) => void; onCancel: () => void }) {
  const { t } = useI18n()
  const [m, setM] = useState({ date: initial?.date ?? null, description: initial?.description[0] ?? null, extra: initial?.description[1] ?? null,
    amount: initial?.amount ?? null, debit: initial?.debit ?? null, credit: initial?.credit ?? null, currency: initial?.currency ?? null })
  const ok = m.date != null && m.description != null && (m.amount != null || m.debit != null || m.credit != null)
  const letter = (i: number) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : '')
  const pick = (key: keyof typeof m, label: keyof Dict) => <li key={key}><label className="row">
    <span className="row-main"><span>{t(label)}</span></span>
    <select className="row-input row-select" value={m[key] ?? ''} onChange={e => setM(x => ({ ...x, [key]: e.target.value === '' ? null : Number(e.target.value) }))}>
      <option value="">{t('imp.col.none')}</option>
      {header.map((h, i) => <option key={i} value={i}>{letter(i)} · {h.trim() || t('imp.col.empty')}</option>)}
    </select></label></li>
  return <div className="import-review">
    <section className="group">
      <h2 className="group-title">{t('imp.columnsTitle')}</h2>
      <p className="muted small group-intro">{t('imp.columnsHint')}</p>
      <ul className="group-list">
        {pick('date', 'imp.col.date')}{pick('description', 'imp.col.description')}{pick('amount', 'imp.col.amount')}
        {pick('debit', 'imp.col.debit')}{pick('credit', 'imp.col.credit')}{pick('extra', 'imp.col.extra')}{pick('currency', 'imp.col.currency')}
      </ul>
      {!ok && <p className="group-foot" role="status">{t('imp.columnsMissing')}</p>}
    </section>
    <div className="form-end cat-end">
      <button type="button" className="link-btn" onClick={onCancel}>{t('imp.previewCancel')}</button>
      <button type="button" className="btn primary" disabled={!ok} onClick={() => onDone({ date: m.date!, description: [m.description!, ...(m.extra != null && m.extra !== m.description ? [m.extra] : [])],
        amount: m.amount, debit: m.amount != null ? null : m.debit, credit: m.amount != null ? null : m.credit, currency: m.currency, fee: null, state: null })}>{t('imp.continue')}</button>
    </div>
  </div>
}

/** Numeri o date ambigui (o scritti in due modi): si sceglie, vedendo come verrebbero letti gli esempi del file. */
function Formats({ needs, cur, cancel, onDone }: { needs: NonNullable<ReturnType<typeof readStatement>['needs']>; cur: string; cancel: ReactNode; onDone: (o: StatementOptions) => void }) {
  const { t, money, date } = useI18n()
  const [draft, setDraft] = useState<StatementOptions>({})
  const { number, date: dates } = needs
  const ready = (!number || draft.mark) && (!dates || draft.order)
  const long = (iso: string) => date(iso, { day: 'numeric', month: 'short', year: 'numeric' })
  const choice = (on: boolean, label: string, detail: string, pick: () => void) => (
    <li key={label}><button type="button" className="row" role="radio" aria-checked={on} onClick={pick}>
      <span className="row-main"><span>{label}</span><small>{detail}</small></span>
      {on && <Icon name="check" size={18} className="row-check" />}
    </button></li>
  )
  return <div className="import-review">
    {number && <section className="group">
      <h2 className="group-title">{t('imp.numbers')}</h2>
      <p className="muted small group-intro">{number.conflicting ? t('imp.numberConflict') : t('imp.numberAsk', { sample: number.samples[0] ?? '' })}</p>
      <ul className="group-list" role="radiogroup" aria-label={t('imp.numbers')}>
        {MARKS.map(mk => choice(draft.mark === mk, t(mk === ',' ? 'imp.markComma' : 'imp.markDot'),
          number.samples.map(s => { const r = parseMoney(s, mk); return `${s} → ${r.ok ? money(r.value, cur) : t('imp.invalid')}` }).join(' · '),
          () => setDraft(d => ({ ...d, mark: mk }))))}
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
      {cancel}
      <button type="button" className="btn primary" disabled={!ready} onClick={() => onDone(draft)}>{t('imp.continue')}</button>
    </div>
  </div>
}
