import { useState, type ChangeEvent } from 'react'
import { keywordFor, readStatement, type Settings, type Transaction } from '../engine'
import { useI18n } from '../i18n/core'
import { useStore } from '../store/context'
import { duplicateCandidates, newId, planImport, type InboxItem } from '../store/state'
import { track } from '../beta/telemetry'
import { Icon } from './Icon'
import { bucketName, categoryName } from './names'

/** Importa un estratto conto e mostra la casella "Da confermare": tutto si può cambiare prima di confermare. */
export function InboxView({ settings }: { settings: Settings }) {
  const { t, money, date } = useI18n()
  const { state, dispatch } = useStore()
  const inbox = state.data?.inbox ?? []
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [suggested] = useState(() => new Map(inbox.map(i => [i.id, i.category])))   // per capire se l'utente ha corretto

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !state.data) return
    const { rows } = readStatement(await file.text())
    if (!rows.length) { setMsg({ text: t('imp.none'), bad: true }); return }
    const { items, duplicates } = planImport(state.data, rows)
    items.forEach(i => suggested.set(i.id, i.category))
    dispatch({ type: 'addInbox', items })
    void track('import')
    setMsg({ text: t('imp.result', { n: items.length, d: duplicates }) })
  }

  const toTx = (i: InboxItem) => ({ id: newId(), date: i.date, description: i.description, category: i.category,
    amount: Math.abs(i.amount), currency: i.currency, fxRate: null, paidFrom: i.paidFrom })
  const dups = state.data ? duplicateCandidates(state.data) : new Map<string, Transaction>()
  const ready = inbox.filter(i => i.category && !dups.has(i.id))      // "conferma tutti" salta i possibili doppioni

  return (
    <section className={`card${inbox.length ? ' card-inbox' : ''}`}>
      <div className="card-head">
        <h3 className="h-plain">{inbox.length ? t('inbox.title', { n: inbox.length }) : t('imp.import')}</h3>
        <label className="btn small-btn"><Icon name="upload" size={16} />{t('imp.import')}
          <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={onFile} /></label>
      </div>
      <p className="muted small">{inbox.length ? t('inbox.hint') : t('imp.hint')}</p>
      {msg && <p className={msg.bad ? 'bad-text small' : 'good-text small'} role="status">{msg.text}</p>}
      {dups.size > 0 && <p className="dup-note small"><Icon name="alert" size={15} />{dups.size === 1 ? t('imp.dupsOne') : t('imp.dups', { n: dups.size })}</p>}

      {ready.length > 1 && (
        <button className="btn" onClick={() => dispatch({ type: 'confirmInbox', ids: ready.map(i => i.id), txs: ready.map(toTx) })}><Icon name="check" size={16} />{t('inbox.confirmAll', { n: ready.length })}
        </button>
      )}

      <ul className="inbox-list">
        {inbox.map(i => <InboxRow key={i.id} item={i} settings={settings} suggestedCategory={suggested.get(i.id) ?? null}
          duplicateOf={dups.get(i.id) ?? null}
          onChange={item => dispatch({ type: 'updateInbox', item })}
          onConfirm={(item, keyword) => dispatch({ type: 'confirmInbox', ids: [item.id], txs: [toTx(item)],
            rule: keyword ? { id: newId(), keyword, category: item.category!, paidFrom: item.paidFrom, enabled: true } : undefined })}
          onIgnore={item => dispatch({ type: 'ignoreInbox', ids: [item.id] })}
          money={money} date={date} t={t} />)}
      </ul>
    </section>
  )
}

function InboxRow({ item, settings, suggestedCategory, duplicateOf, onChange, onConfirm, onIgnore, money, date, t }: {
  item: InboxItem; settings: Settings; suggestedCategory: string | null; duplicateOf: Transaction | null
  onChange: (i: InboxItem) => void; onConfirm: (i: InboxItem, keyword?: string) => void; onIgnore: (i: InboxItem) => void
  money: (n: number, c: string) => string; date: (iso: string) => string; t: ReturnType<typeof useI18n>['t']
}) {
  const [keyword, setKeyword] = useState(() => keywordFor(item.description))
  const changed = item.category !== suggestedCategory
  const [remember, setRemember] = useState(false)
  const income = item.amount > 0
  const cats = settings.categories.filter(c => (c.type === 'income') === income)
  return (
    <li className={`inbox-item${duplicateOf ? ' dup' : item.category ? '' : ' needs'}`}>
      <div className="inbox-top">
        <span className="tx-date">{date(item.date)}</span>
        <span className="tx-desc" title={item.description}>{item.description}</span>
        <span className={`tx-amount${income ? ' income' : ''}`}>{income ? '+' : '−'}{money(Math.abs(item.amount), item.currency || settings.currency)}</span>
      </div>
      <div className="inbox-edit">
        <select aria-label={t('tx.category')} value={item.category ?? ''} aria-invalid={!item.category}
                onChange={e => { onChange({ ...item, category: e.target.value || null }); setRemember(true) }}>
          <option value="">{t('inbox.pickCategory')}</option>
          {cats.map(c => <option key={c.id} value={c.id}>{categoryName(c, t)}</option>)}
        </select>
        <select aria-label={t('tx.paidFrom')} value={item.paidFrom ?? ''} onChange={e => onChange({ ...item, paidFrom: e.target.value || null })}>
          <option value="">{income ? t('tx.paidFromSplit') : t('tx.paidFromDefault')}</option>
          {settings.buckets.map(b => <option key={b.id} value={b.id}>{bucketName(b, t)}</option>)}
        </select>
      </div>
      {item.category && changed && (
        <label className="check remember">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          {t('inbox.remember', { k: '' }).replace(/[“”«»"]\s*[“”«»"]?$/, '')}
          <input className="kw-input" value={keyword} onChange={e => setKeyword(e.target.value)} aria-label={t('rules.keyword')} />
        </label>
      )}
      {duplicateOf && (
        <p className="dup-note small" role="note"><Icon name="alert" size={15} />{t('inbox.dup', { desc: duplicateOf.description || '—',
          amount: money(duplicateOf.amount ?? 0, duplicateOf.currency || settings.currency), date: duplicateOf.date ? date(duplicateOf.date) : '—' })}</p>
      )}
      <div className="inbox-actions">
        {duplicateOf ? (
          <>
            <button className="btn small-btn" disabled={!item.category}
                    onClick={() => onConfirm(item)}>{t('inbox.addAnyway')}</button>
            <button className="btn small-btn primary" onClick={() => onIgnore(item)}><Icon name="check" size={16} />{t('inbox.same')}</button>
          </>
        ) : (
          <>
            <button className="btn small-btn" onClick={() => onIgnore(item)}>{t('inbox.ignore')}</button>
            <button className="btn small-btn primary" disabled={!item.category}
                    onClick={() => onConfirm(item, item.category && changed && remember && keyword.trim() ? keyword.trim() : undefined)}><Icon name="check" size={16} />{t('inbox.confirm')}</button>
          </>
        )}
      </div>
    </li>
  )
}
