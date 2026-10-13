import { useState, type FormEvent } from 'react'
import { CUSTOM, FIRST, SPLIT, addDays, splitOk, splitTotal, fxRate, suggest, todayIso, type CategoryType, type Settings, type Transaction } from '../engine'
import { useI18n } from '../i18n/core'
import { newId, parseAmount } from '../store/state'
import { Icon } from './Icon'
import { SplitEditor } from './SplitEditor'
import { BUCKET_COLORS, CURRENCIES, bucketName, categoryName } from './names'
import { AmountInput } from './kit/AmountInput'
import { amountText } from './kit/amount'

const GROUPS: CategoryType[] = ['expense', 'income', 'saving']

/**
 * Nuovo movimento. L'importo è il protagonista; sotto, le categorie come nomi con il blocco della loro parte;
 * poi i dettagli (descrizione, data, parte) come righe sulla superficie. La data di oggi è già pronta.
 */
export function TxForm({ settings, initial, prefill, defaultDate, onSave, onDelete, onClose }: {
  settings: Settings
  initial?: Transaction
  prefill?: { amount?: string; description?: string; category?: string }
  defaultDate: string
  onSave: (tx: Transaction) => void
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const { t, money, lang } = useI18n()
  const [amount, setAmount] = useState(initial?.amount != null ? amountText(initial.amount, lang) : (prefill?.amount ?? ''))
  const [category, setCategory] = useState<string | null>(() => {
    if (initial) return initial.category
    if (prefill?.category && settings.categories.some(c => c.id === prefill.category)) return prefill.category
    if (prefill?.description) {        // link rapido con descrizione: la categoria arriva dalle regole
      const hit = suggest(prefill.description, -1, settings)
      if (hit.ruleId) return hit.category
    }
    return null
  })
  const [description, setDescription] = useState(initial?.description ?? prefill?.description ?? '')
  const [catTouched, setCatTouched] = useState(!!initial)
  const [fromRule, setFromRule] = useState(false)
  // mentre si scrive la descrizione, le regole propongono la categoria (finché l'utente non ne sceglie una)
  const onDescription = (v: string) => {
    setDescription(v)
    if (catTouched) return
    const out = suggest(v, -1, settings), inc = suggest(v, 1, settings)
    const hit = out.ruleId ? out : inc.ruleId ? inc : null
    setFromRule(!!hit)
    if (hit) { setCategory(hit.category); if (hit.paidFrom) setPaidFrom(hit.paidFrom) }
  }
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [paidFrom, setPaidFrom] = useState(initial?.paidFrom ?? '')
  const [split, setSplit] = useState<Record<string, number> | null>(initial?.split ?? null)
  const [currency, setCurrency] = useState(initial?.currency || settings.currency)
  const [errors, setErrors] = useState<string[]>([])


  const cat = settings.categories.find(c => c.id === category)
  const isIncome = cat?.type === 'income'
  // un'entrata mostra sempre dove va davvero: la scelta del movimento, altrimenti quella della categoria, altrimenti la regola
  const incomeTo = paidFrom || cat?.defaultBucket || SPLIT
  // le quote partono da quelle della categoria, altrimenti dalla regola: il totale è già 100% e si sposta solo ciò che serve
  const incomeSplit = split ?? (cat?.defaultBucket === CUSTOM ? cat.split : null) ?? Object.fromEntries(settings.buckets.map(b => [b.id, b.share]))
  const parsed = parseAmount(amount)
  const foreign = currency !== settings.currency
  // un movimento già registrato tiene il suo cambio, a meno che non si cambi valuta
  const rate = foreign ? (initial?.currency === currency && initial?.fxRate ? initial.fxRate : fxRate(currency, settings)) : 1
  const currencies = [...new Set([settings.currency, ...CURRENCIES, ...Object.keys(settings.fxRates)])]

  function submit(e: FormEvent) {
    e.preventDefault()
    const errs: string[] = []
    if (parsed == null || parsed <= 0) errs.push(t('tx.errAmount'))
    if (!category) errs.push(t('tx.errCategory'))
    if (!date) errs.push(t('tx.errDate'))
    if (isIncome && incomeTo === CUSTOM && !splitOk(incomeSplit)) errs.push(t('split.err', { n: String(Math.round(splitTotal(incomeSplit) * 1000) / 10).replace('.', ',') }))
    setErrors(errs)
    if (errs.length) return
    onSave({
      id: initial?.id ?? newId(), date, description: description.trim(), category, amount: parsed,
      currency: foreign ? currency : null, fxRate: foreign ? rate : null,
      ...(isIncome ? { paidFrom: incomeTo, split: incomeTo === CUSTOM ? incomeSplit : null } : { paidFrom: paidFrom || null }),
    })
  }

  const kinds = GROUPS.filter(g => settings.categories.some(c => c.type === g))
  const [kindPick, setKind] = useState<CategoryType>('expense')
  // il tipo segue la categoria scelta (anche quando la propone una regola)
  const kind: CategoryType = cat?.type ?? kindPick
  const yesterday = addDays(todayIso(), -1)
  // il blocco di una categoria: la parte da cui escono i soldi (inchiostro se pagata prima delle parti); le entrate non ne hanno
  const blockOf = (c: Settings['categories'][number]) => c.type === 'income' ? null : c.defaultBucket === FIRST ? 'var(--text)'
    : BUCKET_COLORS[settings.buckets.findIndex(b => b.id === c.defaultBucket)] ?? null

  return (
    <div className="tx-sheet">
      <form onSubmit={submit} noValidate>
        <div className="txs-head">
          <button type="button" className="icon-btn ghost" onClick={onClose} aria-label={t('action.close')}><Icon name="close" size={20} /></button>
          <h2 id="tx-title">{initial ? t('tx.edit') : t('tx.new')}</h2>
          <span className="icon-btn ghost" aria-hidden="true" />
        </div>

        {kinds.length > 1 && (
          <div className="segmented txs-kind" role="tablist" style={{ gridTemplateColumns: `repeat(${kinds.length}, 1fr)` }}>
            {kinds.map(k => (
              <button type="button" key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''}
                      onClick={() => { setKind(k); if (cat && cat.type !== k) { setCategory(null); setCatTouched(false) } }}>{t(`type.${k}`)}</button>))}
            <span className="seg-pill" style={{ width: `calc((100% - 8px) / ${kinds.length})`, transform: `translateX(${kinds.indexOf(kind) * 100}%)` }} />
          </div>
        )}

        <div className="txs-amount">
          <AmountInput className="amount-input" placeholder="0,00" autoFocus={!initial} aria-label={t('tx.amount')}
                 value={amount} onChange={setAmount} aria-invalid={errors.length > 0 && (parsed == null || parsed <= 0)} />
          <select className="txs-cur" value={currency} onChange={e => setCurrency(e.target.value)} aria-label={t('tx.currency')}>
            {currencies.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {parsed != null && parsed > 0 && foreign && (
          <p className={`txs-fx small ${rate == null ? 'bad-text' : 'muted'}`}>
            {rate == null ? t('tx.noRate', { cur: currency })
              : t('tx.converted', { amount: money(parsed * rate, settings.currency), rate: String(rate).replace('.', ',') })}
          </p>
        )}

        <div className="cat-pick" role="radiogroup" aria-label={t('tx.category')}>
          {settings.categories.filter(c => c.type === kind).map(c => {
            const block = blockOf(c)
            return (
              <button type="button" key={c.id} role="radio" aria-checked={category === c.id} className={category === c.id ? 'on' : ''}
                      onClick={() => { if (c.id !== category && c.type === 'income') { setPaidFrom(''); setSplit(null) } setCategory(c.id); setCatTouched(true); setFromRule(false) }}>
                {block && <i style={{ background: block }} aria-hidden="true" />}{categoryName(c, t)}
              </button>
            )
          })}
        </div>
        {fromRule && category && <p className="txs-note">{t('tx.fromRule')}</p>}

        <div className="txs-rows">
          <label className="txs-row">
            <span>{t('tx.description')}</span>
            <input value={description} onChange={e => onDescription(e.target.value)} placeholder={t('tx.descriptionPlaceholder')} />
          </label>
          <div className="txs-row">
            <span>{t('tx.date')}</span>
            <div className="txs-date">
              <button type="button" className={`mini-chip${date === todayIso() ? ' on' : ''}`} onClick={() => setDate(todayIso())}>{t('day.today')}</button>
              <button type="button" className={`mini-chip${date === yesterday ? ' on' : ''}`} onClick={() => setDate(yesterday)}>{t('day.yesterday')}</button>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required aria-label={t('tx.date')} />
            </div>
          </div>
          {isIncome ? <label className="txs-row">
            <span>{t('tx.incomeTo')}</span>
            <select value={incomeTo} onChange={e => setPaidFrom(e.target.value)}>
              <option value={SPLIT}>{t('split.rule')}</option>
              {settings.buckets.map(b => <option key={b.id} value={b.id}>{t('split.all', { part: bucketName(b, t) })}</option>)}
              <option value={CUSTOM}>{t('split.custom')}</option>
            </select>
          </label> : <label className="txs-row">
            <span>{t('tx.paidFrom')}</span>
            <select value={paidFrom} onChange={e => setPaidFrom(e.target.value)}>
              <option value="">{t('tx.paidFromDefault')}</option>
              {settings.buckets.map(b => <option key={b.id} value={b.id}>{bucketName(b, t)}</option>)}
            </select>
          </label>}
        </div>
        {isIncome && incomeTo === CUSTOM && <SplitEditor key={category} buckets={settings.buckets} value={incomeSplit} onChange={setSplit} />}

        {errors.length > 0 && <ul className="errors" role="alert">{errors.map(e => <li key={e}>{e}</li>)}</ul>}

        <div className="txs-actions">
          <button type="submit" className="btn primary big-btn wide">{t('action.save')}</button>
          {initial && onDelete && (
            <button type="button" className="link-btn danger-link" onClick={() => { if (confirm(t('tx.confirmDelete'))) onDelete(initial.id) }}>
              {t('action.delete')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
