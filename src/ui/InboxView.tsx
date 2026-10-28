import { useState, type ChangeEvent } from 'react'
import { keywordFor, readStatement, type Settings, type Transaction } from '../engine'
import { useI18n } from '../i18n/core'
import { useStore } from '../store/context'
import { duplicateCandidates, newId, planImport, type InboxItem } from '../store/state'
import { track } from '../beta/telemetry'
import { Icon } from './Icon'
import { bucketName, categoryName } from './names'
import { parseConsolidated, readConsolidatedWorkbook, type ConsolidatedPreview } from '../engine/consolidatedStatement'
import { todayIso, updateCapital } from '../engine'

/** Importa un estratto conto e mostra la casella "Da confermare": tutto si può cambiare prima di confermare. */
export function InboxView({ settings }: { settings: Settings }) {
  const { t, money, date } = useI18n()
  const { state, dispatch, lease } = useStore()
  const inbox = state.data?.inbox ?? []
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [previewState, setPreviewState] = useState<{ owner: typeof lease; value: ConsolidatedPreview } | null>(null)
  const preview = previewState && previewState.owner === lease && (!lease || lease.current()) ? previewState.value : null
  const setPreview = (value: ConsolidatedPreview | null) => setPreviewState(value ? { owner: lease, value } : null)
  const [depositTarget, setDepositTarget] = useState('none')
  const [suggested] = useState(() => new Map(inbox.map(i => [i.id, i.category])))   // per capire se l'utente ha corretto

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !state.data) return
    setPreview(null); setDepositTarget('none')
    if (/\.xlsx$/i.test(file.name)) {
      try {
        const result = await readConsolidatedWorkbook(file)
        if (lease && !lease.current()) return
        if (!result) { setMsg({ text: t('imp.xlsx'), bad: true }); return }
        setMsg(null); setPreview(result)
      } catch { setMsg({ text: t('imp.xlsx'), bad: true }) }
      return
    }
    if (/\.xls$/i.test(file.name)) { setMsg({ text: t('imp.xlsx'), bad: true }); return }
    const text = await file.text()
    if (lease && !lease.current()) return
    const consolidated = parseConsolidated(text)
    if (consolidated) { setMsg(null); setPreview(consolidated); return }
    if (/(?:conto personale|personal account)\s*\(eur\)/i.test(text)) { setMsg({ text: t('imp.sections'), bad: true }); return }
    const { rows, error } = readStatement(text)
    if (error === 'multiple_sections') { setMsg({ text: t('imp.sections'), bad: true }); return }
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

  const confirmPreview = () => {
    if (!preview || !state.data || (lease && !lease.current())) return
    if (depositTarget !== 'none' && settings.currency !== 'EUR') return
    const { items, duplicates } = planImport(state.data, preview.rows)
    if (depositTarget !== 'none' && preview.depositBalance != null) {
      const day = todayIso(), existing = state.data.settings.capital ?? { date: day, parts: [], history: [] }
      if (depositTarget !== 'new' && !existing.parts.some(p => p.id === depositTarget)) return
      const parts = depositTarget === 'new'
        ? [...existing.parts, { id: newId(), name: t('imp.depositName'), kind: 'liquid' as const, policy: 'never' as const, amount: preview.depositBalance }]
        : existing.parts.map(p => p.id === depositTarget ? { ...p, amount: preview.depositBalance! } : p)
      dispatch({ type: 'setSettings', settings: { ...state.data.settings, capital: updateCapital(existing, parts, day) } })
    }
    items.forEach(i => suggested.set(i.id, i.category)); dispatch({ type: 'addInbox', items })
    setMsg({ text: t('imp.result', { n: items.length, d: duplicates }) }); setPreview(null)
  }
  const importPreview = preview && <section className="card" role="region" aria-label={t('imp.previewTitle')}>
    <h3>{t('imp.previewTitle')}</h3>
    <p>{t('imp.period', { from: date(preview.periodStart, { day: 'numeric', month: 'short', year: 'numeric' }), to: date(preview.periodEnd, { day: 'numeric', month: 'short', year: 'numeric' }) })}</p>
    <p>{t('imp.previewSummary', { n: preview.rows.length, transfers: preview.transfersExcluded })}</p>
    {preview.repeatedRows > 0 && <p role="note">{t('imp.repeatedRows', { n: preview.repeatedRows })}</p>}
    {preview.depositBalance != null && <>
      <p>{t('imp.depositBalance', { amount: money(preview.depositBalance, 'EUR') })}</p>
      <p>{t('imp.depositWarning')}</p>
      {settings.currency !== 'EUR' && <p role="note">{t('imp.depositCurrency')}</p>}
      <label>{t('imp.depositChoice')} <select value={depositTarget} disabled={settings.currency !== 'EUR'} onChange={e => setDepositTarget(e.target.value)}>
        <option value="none">{t('imp.depositNone')}</option>
        <option value="new">{t('imp.depositNew')}</option>
        {(state.data?.settings.capital?.parts ?? []).map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
      </select></label>
    </>}
    <button className="btn" onClick={confirmPreview}>{t('imp.previewConfirm')}</button>
    <button className="btn" onClick={() => setPreview(null)}>{t('imp.previewCancel')}</button>
  </section>

  // niente da confermare: una riga sola per importare (il file si sceglie toccandola)
  if (!inbox.length) return (
    <div className="import-row">{importPreview}
      <label className="row"><Icon name="upload" size={20} className="row-lead" />
        <span className="row-main"><span>{t('imp.import')}</span><small>{t('imp.short')}</small></span>
        <Icon name="chevron" size={18} className="row-chev" />
        <input type="file" accept=".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={onFile} /></label>
      {msg && <p className={msg.bad ? 'bad-text small' : 'good-text small'} role="status">{msg.text}</p>}
    </div>
  )
  return (
    <section className="card card-inbox">
      {importPreview}
      <div className="card-head">
        <h3 className="h-plain">{t('inbox.title', { n: inbox.length })}</h3>
        <label className="btn small-btn"><Icon name="upload" size={16} />{t('imp.import')}
          <input type="file" accept=".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={onFile} /></label>
      </div>
      <p className="muted small">{t('inbox.hint')}</p>
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
