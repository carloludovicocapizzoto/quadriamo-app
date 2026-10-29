import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Segmented } from './kit/Segmented'
import { CUSTOM, FIRST, SPLIT, addDays, splitOk, splitTotal, fxRate, suggest, todayIso, type CategoryType, type Settings, type Transaction, partForPurchase } from '../engine'
import { useI18n } from '../i18n/core'
import { newId } from '../store/state'
import { parseAmount } from './kit/amount'
import { Icon } from './Icon'
import { SplitEditor } from './SplitEditor'
import { BUCKET_COLORS, CURRENCIES, bucketName, categoryName } from './names'
import { AmountInput } from './kit/AmountInput'
import { amountText } from './kit/amount'
import { decimalText } from './kit/decimal'

const GROUPS: CategoryType[] = ['expense', 'income', 'saving']
type Category = Settings['categories'][number]

/** Lo zero di esempio nel campo importo: separatore della lingua, decimali della valuta (EUR «0.00» in inglese, JPY «0»). */
const zeroText = (lang: string, currency: string) => {
  let digits = 2
  try { digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2 } catch { /* codice sconosciuto: due decimali */ }
  return new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(0)
}

/**
 * Nuovo movimento. L'importo è il protagonista; sotto, le categorie come nomi con il blocco della loro parte;
 * poi i dettagli (descrizione, data, parte) come righe sulla superficie. La data di oggi è già pronta.
 */
export function TxForm({ settings, initial, prefill, defaultDate, onSave, onDelete, onClose }: {
  settings: Settings
  initial?: Transaction
  prefill?: { amount?: string; description?: string; category?: string }
  defaultDate: string
  /** `categories`: le categorie create qui con «+», da salvare insieme al movimento */
  onSave: (tx: Transaction, categories: Category[]) => void
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const { t, money, lang, date: dateText } = useI18n()
  // categorie create sul momento: entrano nelle impostazioni solo quando si salva il movimento
  const [created, setCreated] = useState<Category[]>([])
  const categories = [...settings.categories, ...created]
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


  const cat = categories.find(c => c.id === category)
  const isIncome = cat?.type === 'income'
  // un'entrata mostra sempre dove va davvero: la scelta del movimento, altrimenti quella della categoria, altrimenti la regola
  const incomeTo = paidFrom || cat?.defaultBucket || SPLIT
  // le quote partono da quelle della categoria, altrimenti dalla regola: il totale è già 100% e si sposta solo ciò che serve
  const incomeSplit = split ?? (cat?.defaultBucket === CUSTOM ? cat.split : null) ?? Object.fromEntries(settings.buckets.map(b => [b.id, b.share]))
  const parsed = parseAmount(amount, lang)
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
    if (isIncome && incomeTo === CUSTOM && !splitOk(incomeSplit)) errs.push(t('split.err', { n: decimalText(Math.round(splitTotal(incomeSplit) * 1000) / 10, lang) }))
    setErrors(errs)
    if (errs.length) return
    onSave({
      id: initial?.id ?? newId(), date, description: description.trim(), category, amount: parsed,
      currency: foreign ? currency : null, fxRate: foreign ? rate : null,
      ...(isIncome ? { paidFrom: incomeTo, split: incomeTo === CUSTOM ? incomeSplit : null } : { paidFrom: paidFrom || null }),
    }, created)
  }

  const kinds = GROUPS.filter(g => settings.categories.some(c => c.type === g))
  const [kindPick, setKind] = useState<CategoryType>('expense')
  // il tipo segue la categoria scelta (anche quando la propone una regola)
  const kind: CategoryType = cat?.type ?? kindPick
  const yesterday = addDays(todayIso(), -1)
  const pick = (c: Category) => {
    if (c.id !== category && c.type === 'income') { setPaidFrom(''); setSplit(null) }
    setCategory(c.id); setCatTouched(true); setFromRule(false)
  }

  // «+»: una categoria nuova del tipo scelto, col nome e (per spese e risparmi) la parte, come in Impostazioni
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPart, setNewPart] = useState(settings.buckets[0]?.id ?? '')
  const partChoices = [...settings.buckets.map(b => ({ id: b.id, label: bucketName(b, t) })), ...(kind === 'expense' ? [{ id: FIRST, label: t('bucket.first') }] : [])]
  const closeAdding = () => { setAdding(false); setNewName('') }
  const addCategory = () => {
    const name = newName.trim()
    if (!name) return
    // lo stesso nome nello stesso tipo: si sceglie quella che c'è già, niente doppioni
    const same = categories.find(c => c.type === kind && categoryName(c, t).trim().toLocaleLowerCase(lang) === name.toLocaleLowerCase(lang))
    const part = partChoices.some(o => o.id === newPart) ? newPart : settings.buckets[0]?.id ?? null
    const c: Category = same ?? { id: newId(), name, type: kind, defaultBucket: kind === 'income' ? null : part }
    if (!same) setCreated(list => [...list, c])
    pick(c)
    closeAdding()
  }
  const onNewKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addCategory() }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeAdding() }
  }
  // il blocco di una categoria: la parte da cui escono i soldi (inchiostro se pagata prima delle parti); le entrate non ne hanno
  const blockOf = (c: Category) => c.type === 'income' ? null : c.defaultBucket === FIRST ? 'var(--text)'
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
          <Segmented className="txs-kind" value={kind} options={kinds.map(k => ({ id: k, label: t(`type.${k}`) }))}
            onChange={k => { setKind(k); closeAdding(); if (cat && cat.type !== k) { setCategory(null); setCatTouched(false) } }} />
        )}

        <div className="txs-amount">
          <AmountInput className="amount-input" placeholder={zeroText(lang, currency)} autoFocus={!initial} aria-label={t('tx.amount')}
                 value={amount} onChange={setAmount} aria-invalid={errors.length > 0 && (parsed == null || parsed <= 0)} />
          <select className="txs-cur" value={currency} onChange={e => setCurrency(e.target.value)} aria-label={t('tx.currency')}>
            {currencies.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {parsed != null && parsed > 0 && foreign && (
          <p className={`txs-fx small ${rate == null ? 'bad-text' : 'muted'}`}>
            {rate == null ? t('tx.noRate', { cur: currency })
              : t('tx.converted', { amount: money(parsed * rate, settings.currency), rate: decimalText(rate, lang) })}
          </p>
        )}

        <div className="cat-pick" role="radiogroup" aria-label={t('tx.category')}>
          {categories.filter(c => c.type === kind).map(c => {
            const block = blockOf(c)
            return (
              <button type="button" key={c.id} role="radio" aria-checked={category === c.id} className={category === c.id ? 'on' : ''} onClick={() => pick(c)}>
                {block && <i style={{ background: block }} aria-hidden="true" />}{categoryName(c, t)}
              </button>
            )
          })}
          {!adding && (
            <button type="button" className="cat-add" onClick={() => { setNewPart(settings.buckets[0]?.id ?? ''); setAdding(true) }}>
              <Icon name="plus" size={16} />{t('settings.newCategory')}
            </button>
          )}
        </div>
        {adding && (
          <div className="cat-new">
            <div className="cat-new-name">
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={onNewKey} autoFocus maxLength={40}
                     placeholder={t('tx.categoryName')} aria-label={t('tx.categoryName')} enterKeyHint="done" />
              <button type="button" className="btn primary" onClick={addCategory} disabled={!newName.trim()}>{t('tx.addCategory')}</button>
              <button type="button" className="icon-btn ghost" onClick={closeAdding} aria-label={t('action.cancel')}><Icon name="close" size={18} /></button>
            </div>
            {kind !== 'income' && (
              <label className="txs-row">
                <span>{t('settings.bucket')}</span>
                <select value={newPart} onChange={e => setNewPart(e.target.value)}>
                  {partChoices.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
        {/* spesa grande in una categoria abbinata: da quale parte del capitale può venire (solo un'informazione) */}
        {kind === 'expense' && parsed != null && (() => {
          const part = partForPurchase(settings.capital, category ?? undefined, parsed)
          return part && <p className="small muted txs-hint cap-hint">{t('cap.adv.purchase', { part: part.name, amount: money(part.amount, settings.currency) })}</p>
        })()}
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
              {/* la data scritta corta nella lingua; sopra c'è il campo vero, trasparente, che apre il calendario del sistema */}
              <span className="txs-day">
                {dateText(date, { day: 'numeric', month: 'short', ...(date.slice(0, 4) === todayIso().slice(0, 4) ? {} : { year: 'numeric' }) })}
                <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} required aria-label={t('tx.date')}
                       onClick={e => { try { e.currentTarget.showPicker?.() } catch { /* il browser apre il suo */ } }} />
              </span>
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
