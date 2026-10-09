import { useRef, useState, type ChangeEvent } from 'react'
import { DEFAULT_CATEGORIES, type CategoryType, type Settings } from '../engine'
import { LANGS, useI18n, type Lang } from '../i18n/core'
import { useStore } from '../store/context'
import { newId, parseAmount, parseBackup, toCsv, validateSettings, type AppData } from '../store/state'
import { AccountSection } from './AccountSection'
import { BUCKET_COLORS, CURRENCIES, bucketName, categoryName } from './names'

const TYPES: CategoryType[] = ['expense', 'income', 'saving']
const DEFAULT_IDS = new Set(DEFAULT_CATEGORIES.map(c => c.id))
const pct = (share: number) => String(Math.round(share * 1000) / 10).replace('.', ',')

export function SettingsView() {
  const { t, lang, setLang } = useI18n()
  const { state, dispatch } = useStore()
  const data = state.data!
  const [draft, setDraft] = useState<Settings>(() => structuredClone(data.settings))
  const [shares, setShares] = useState(() => draft.buckets.map(b => pct(b.share)))
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const flash = (text: string, bad = false) => {
    setMsg({ text, bad })
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), bad ? 4000 : 1500)
  }
  const errors = validateSettings(draft)
  const total = Math.round(draft.buckets.reduce((a, b) => a + b.share, 0) * 1000) / 10

  // salvataggio automatico: ogni modifica valida viene salvata subito (niente modifiche perse cambiando scheda)
  const edit = (fn: (s: Settings) => void) => {
    const next = structuredClone(draft)
    fn(next)
    setDraft(next)
    if (!validateSettings(next).length) {
      dispatch({ type: 'setSettings', settings: next })
      flash(t('settings.saved'))
    }
  }

  function download(content: string, type: string, name: string) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([content], { type }))
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.${type.includes('csv') ? 'csv' : 'json'}`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const exportBackup = () => download(JSON.stringify(data, null, 2), 'application/json', 'quadriamo-backup')
  const exportCsv = () => download('\ufeff' + toCsv(data, {
    category: id => categoryName(data.settings.categories.find(c => c.id === id), t),
    bucket: id => { const b = data.settings.buckets.find(x => x.id === id); return b ? bucketName(b, t) : (id ?? '') },
  }), 'text/csv;charset=utf-8', 'quadriamo-transactions')

  async function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    let parsed: AppData
    try { parsed = parseBackup(await file.text()) } catch { flash(t('settings.importBad'), true); return }
    if (!confirm(t('settings.importConfirm'))) return
    dispatch({ type: 'replace', data: parsed })
    setDraft(structuredClone(parsed.settings))
    setShares(parsed.settings.buckets.map(b => pct(b.share)))
    flash(t('settings.importOk'))
  }

  function deleteCategory(id: string) {
    const used = data.transactions.filter(tx => tx.category === id).length
    if (used && !confirm(t('settings.deleteCategoryUsed', { n: used }))) return
    edit(s => {
      s.categories = s.categories.filter(c => c.id !== id)
      s.recurring = s.recurring.filter(r => r.category !== id)
    })
  }

  return (
    <div className="settings">
      <AccountSection />
      <section className="card">
        <h3 className="h-plain">{t('settings.general')}</h3>
        <label className="field">
          <span>{t('lang.label')}</span>
          <select value={lang} onChange={e => setLang(e.target.value as Lang)}>
            {Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('settings.currency')}</span>
          <select value={draft.currency} onChange={e => edit(s => { s.currency = e.target.value })}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('settings.startDay')}</span>
          <input type="number" inputMode="numeric" min={1} max={28} value={draft.monthStartDay}
                 aria-invalid={errors.includes('startDay')}
                 onChange={e => edit(s => { s.monthStartDay = Number(e.target.value) })} />
          <small className="muted">{t('settings.startDayHint')}</small>
        </label>
      </section>

      <section className="card">
        <h3 className="h-plain">{t('settings.rule')}</h3>
        <p className="muted small">{t('settings.ruleHint')}</p>
        <div className="rule-grid">
          <span className="muted small rule-head">{t('settings.name')}</span>
          <span className="muted small rule-head">{t('settings.share')}</span>
          <span className="muted small rule-head">{t('settings.startingBalance')}</span>
          {draft.buckets.map((b, i) => (
            <div className="rule-row" key={b.id}>
              <label><i style={{ background: BUCKET_COLORS[i] }} />
                <input aria-label={t('settings.name')} value={bucketName(b, t)} aria-invalid={!b.name.trim()}
                       onChange={e => edit(s => { s.buckets[i].name = e.target.value || b.id })} /></label>
              <input aria-label={t('settings.share')} placeholder={t('settings.share')} inputMode="decimal" value={shares[i]}
                     aria-invalid={errors.includes('sharesNot100')}
                     onChange={e => {
                       const v = e.target.value
                       setShares(prev => prev.map((x, j) => j === i ? v : x))
                       edit(s => { s.buckets[i].share = (parseAmount(v) ?? 0) / 100 })
                     }} />
              <input aria-label={t('settings.startingBalance')} placeholder={t('settings.startingBalance')} inputMode="decimal"
                     defaultValue={b.startingBalance ? String(b.startingBalance).replace('.', ',') : ''}
                     onChange={e => edit(s => { s.buckets[i].startingBalance = parseAmount(e.target.value) ?? 0 })} />
            </div>
          ))}
        </div>
        <p className={errors.includes('sharesNot100') ? 'bad-text small' : 'good-text small'}>
          {errors.includes('sharesNot100')
            ? `⚠ ${t('settings.ruleBad', { n: String(total).replace('.', ',') })}` : `✓ ${t('settings.ruleOk')}`}
        </p>
      </section>

      <section className="card">
        <h3 className="h-plain">{t('settings.categories')}</h3>
        <ul className="edit-list">
          {draft.categories.map((c, i) => (
            <li key={c.id}>
              <input aria-label={t('settings.name')} value={categoryName(c, t)} aria-invalid={!c.name.trim()}
                     onChange={e => edit(s => { s.categories[i].name = e.target.value || (DEFAULT_IDS.has(c.id) ? c.id : '') })} />
              <select aria-label={t('settings.type')} value={c.type}
                      onChange={e => edit(s => {
                        const ty = e.target.value as CategoryType
                        s.categories[i].type = ty
                        s.categories[i].defaultBucket = ty === 'income' ? null : (s.categories[i].defaultBucket ?? s.buckets[0].id)
                      })}>
                {TYPES.map(ty => <option key={ty} value={ty}>{t(`type.${ty}`)}</option>)}
              </select>
              {c.type !== 'income'
                ? <select aria-label={t('settings.bucket')} value={c.defaultBucket ?? ''}
                          onChange={e => edit(s => { s.categories[i].defaultBucket = e.target.value })}>
                    {draft.buckets.map(b => <option key={b.id} value={b.id}>{bucketName(b, t)}</option>)}
                  </select>
                : <span />}
              <button className="icon-btn" aria-label={t('action.delete')} onClick={() => deleteCategory(c.id)}>×</button>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={() => edit(s => {
          s.categories.push({ id: newId(), name: t('settings.newCategory'), type: 'expense', defaultBucket: s.buckets[0].id })
        })}>+ {t('settings.addCategory')}</button>
      </section>

      <section className="card">
        <h3 className="h-plain">{t('settings.recurring')}</h3>
        <p className="muted small">{t('settings.recurringHint')}</p>
        <ul className="edit-list recurring">
          {draft.recurring.map((r, i) => (
            <li key={i}>
              <input aria-label={t('settings.name')} value={r.name} aria-invalid={!r.name.trim()}
                     onChange={e => edit(s => { s.recurring[i].name = e.target.value })} />
              <input aria-label={t('tx.amount')} inputMode="decimal" defaultValue={r.amount ? String(r.amount).replace('.', ',') : ''}
                     aria-invalid={!(r.amount > 0)} placeholder="0,00"
                     onChange={e => edit(s => { s.recurring[i].amount = parseAmount(e.target.value) ?? 0 })} />
              <select aria-label={t('tx.category')} value={r.category}
                      onChange={e => edit(s => { s.recurring[i].category = e.target.value })}>
                {draft.categories.filter(c => c.type !== 'income').map(c => <option key={c.id} value={c.id}>{categoryName(c, t)}</option>)}
              </select>
              <input aria-label={t('settings.day')} type="number" inputMode="numeric" min={1} max={31} value={r.day ?? ''}
                     onChange={e => edit(s => { s.recurring[i].day = e.target.value ? Number(e.target.value) : null })} />
              <label className="check"><input type="checkbox" checked={r.active}
                     onChange={e => edit(s => { s.recurring[i].active = e.target.checked })} /> {t('settings.active')}</label>
              <button className="icon-btn" aria-label={t('action.delete')}
                      onClick={() => edit(s => { s.recurring.splice(i, 1) })}>×</button>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={() => edit(s => {
          const cat = s.categories.find(c => c.type === 'expense')
          s.recurring.push({ name: t('settings.newRecurring'), amount: 0, category: cat?.id ?? '', day: 1, active: true })
        })}>+ {t('settings.addRecurring')}</button>
      </section>

      <section className="card">
        <h3 className="h-plain">{t('settings.data')}</h3>
        <p className="muted small">🔒 {t('settings.dataHint')}</p>
        <div className="stack-row">
          <button className="btn" onClick={exportBackup}>{t('settings.export')}</button>
          <button className="btn" onClick={exportCsv}>{t('settings.exportCsv')}</button>
          <label className="btn">{t('settings.import')}
            <input type="file" accept="application/json,.json" hidden onChange={importBackup} /></label>
          <button className="btn danger" onClick={() => { if (confirm(t('settings.resetConfirm'))) dispatch({ type: 'replace', data: null }) }}>
            {t('settings.reset')}</button>
        </div>
        <p className="muted small top-gap">{t('settings.install')}</p>
      </section>

      {(errors.length > 0 || msg) && (
        <div className="save-bar" role="status">
          <span className={errors.length || msg?.bad ? 'bad-text small' : 'good-text small'}>
            {errors.length ? `⚠ ${t('settings.errors')}` : `${msg?.bad ? '⚠' : '✓'} ${msg?.text}`}</span>
        </div>
      )}
    </div>
  )
}
