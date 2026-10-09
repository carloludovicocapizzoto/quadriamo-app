import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fxRate, type CategoryType, type Settings, type Transaction } from '../engine'
import { useI18n } from '../i18n/core'
import { newId, parseAmount } from '../store/state'
import { CURRENCIES, bucketName, categoryName } from './names'

const GROUPS: CategoryType[] = ['expense', 'income', 'saving']

/** Inserimento rapido: importo, categoria, (descrizione), data di oggi già pronta. */
export function TxForm({ settings, initial, defaultDate, onSave, onDelete, onClose }: {
  settings: Settings
  initial?: Transaction
  defaultDate: string
  onSave: (tx: Transaction) => void
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const { t, money } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount).replace('.', ',') : '')
  const [category, setCategory] = useState<string | null>(initial?.category ?? null)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [paidFrom, setPaidFrom] = useState(initial?.paidFrom ?? '')
  const [currency, setCurrency] = useState(initial?.currency || settings.currency)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const cat = settings.categories.find(c => c.id === category)
  const isIncome = cat?.type === 'income'
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
    setErrors(errs)
    if (errs.length) return
    onSave({
      id: initial?.id ?? newId(), date, description: description.trim(), category, amount: parsed,
      currency: foreign ? currency : null, fxRate: foreign ? rate : null, paidFrom: paidFrom || null,
    })
  }

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="tx-title">
      <form onSubmit={submit} noValidate>
        <div className="sheet-head">
          <h2 id="tx-title">{initial ? t('tx.edit') : t('tx.new')}</h2>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label={t('action.close')}>×</button>
        </div>

        <div className="amount-row">
          <label className="field">
            <span>{t('tx.amount')}</span>
            <input className="amount-input" inputMode="decimal" autoComplete="off" placeholder="0,00" autoFocus={!initial}
                   value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={errors.length > 0 && (parsed == null || parsed <= 0)} />
          </label>
          <label className="field currency-field">
            <span>{t('tx.currency')}</span>
            <select value={currency} onChange={e => setCurrency(e.target.value)}>
              {currencies.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        {parsed != null && parsed > 0 && (
          <small className={foreign && rate == null ? 'bad-text' : 'muted'}>
            {!foreign ? money(parsed, settings.currency)
              : rate == null ? t('tx.noRate', { cur: currency })
              : t('tx.converted', { amount: money(parsed * rate, settings.currency), rate: String(rate).replace('.', ',') })}
          </small>
        )}

        <fieldset className="field">
          <legend>{t('tx.category')}</legend>
          {GROUPS.map(g => {
            const cats = settings.categories.filter(c => c.type === g)
            if (!cats.length) return null
            return (
              <div key={g} className="chip-group">
                <span className="chip-label">{t(`type.${g}`)}</span>
                <div className="chips">
                  {cats.map(c => (
                    <button type="button" key={c.id} className={`chip${category === c.id ? ' on' : ''}`}
                            aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                      {categoryName(c, t)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </fieldset>

        <label className="field">
          <span>{t('tx.description')}</span>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('tx.descriptionPlaceholder')} />
        </label>

        <label className="field">
          <span>{t('tx.date')}</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </label>

        <label className="field">
          <span>{t('tx.paidFrom')}</span>
          <select value={paidFrom} onChange={e => setPaidFrom(e.target.value)}>
            <option value="">{isIncome ? t('tx.paidFromSplit') : t('tx.paidFromDefault')}</option>
            {settings.buckets.map(b => <option key={b.id} value={b.id}>{bucketName(b, t)}</option>)}
          </select>
          <small className="muted">{t('tx.paidFromHint')}</small>
        </label>

        {errors.length > 0 && <ul className="errors" role="alert">{errors.map(e => <li key={e}>{e}</li>)}</ul>}

        <div className="sheet-actions">
          {initial && onDelete && (
            <button type="button" className="btn danger" onClick={() => { if (confirm(t('tx.confirmDelete'))) onDelete(initial.id) }}>
              {t('action.delete')}
            </button>
          )}
          <button type="button" className="btn" onClick={() => ref.current?.close()}>{t('action.cancel')}</button>
          <button type="submit" className="btn primary">{t('action.save')}</button>
        </div>
      </form>
    </dialog>
  )
}
