// Regole automatiche: una parola nella descrizione sceglie la categoria. Una riga per regola (parola → categoria);
// parola, categoria, attiva ed eliminazione nel pannello.
import { useState } from 'react'
import { seedRules } from '../../engine'
import { useI18n } from '../../i18n/core'
import { newId } from '../../store/state'
import { Icon } from '../Icon'
import { Row } from '../kit/List'
import { Sheet } from '../kit/Sheet'
import { categoryName } from '../names'
import type { SettingsDraft } from './draft'

export function RulesSection({ d: { draft, edit } }: { d: SettingsDraft }) {
  const { t } = useI18n()
  const [showRules, setShowRules] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const rules = draft.rules ?? seedRules()
  const i = rules.findIndex(r => r.id === open)
  const r = i >= 0 ? rules[i] : null
  const change = (fn: (x: (typeof rules)[number]) => void) => edit(s => { s.rules = structuredClone(rules); fn(s.rules[i]) })
  const category = (id: string) => { const c = draft.categories.find(x => x.id === id); return c ? categoryName(c, t) : '—' }
  return (
    <section className="group">
      {/* il titolo è già quello della pagina: qui solo la spiegazione e due righe */}
      <p className="muted small group-intro">{t('rules.hint')}</p>
      <ul className="group-list">
        <li><button type="button" className="row" aria-expanded={showRules} onClick={() => setShowRules(!showRules)}>
          <span className="row-main"><span>{showRules ? t('rules.hide') : t('rules.show', { n: rules.length })}</span></span>
          <Icon name="chevron" size={18} className={`row-chev${showRules ? ' row-chev-open' : ''}`} />
        </button></li>
        <li><button type="button" className="row" onClick={() => {
          const id = newId()
          setShowRules(true)
          edit(s => { s.rules = [{ id, keyword: '', category: draft.categories.find(c => c.type === 'expense')?.id ?? '', paidFrom: null, enabled: true }, ...rules] })
          setOpen(id)
        }}><span className="row-main"><span className="add-row">+ {t('rules.add')}</span></span></button></li>
      </ul>
      {showRules && (
        <ul className="group-list rules-list">
          {rules.map(x => (
            <li key={x.id} className={x.enabled ? undefined : 'rule-off'}><button type="button" className="row" onClick={() => setOpen(x.id)}>
              <span className="row-main"><span className={x.keyword.trim() ? undefined : 'bad-text'}>{x.keyword.trim() || '—'}</span>
                {!x.enabled && <small>{t('rules.off')}</small>}</span>
              <span className="row-value">{category(x.category)}</span>
              <Icon name="chevron" size={18} className="row-chev" />
            </button></li>
          ))}
        </ul>
      )}
      <Sheet open={!!r} onClose={() => setOpen(null)} title={r?.keyword.trim() || t('rules.add')}>
        {r && <>
          <label className="field"><span>{t('rules.keyword')}</span>
            <input autoFocus={!r.keyword} value={r.keyword} aria-invalid={!r.keyword.trim()} onChange={e => change(x => { x.keyword = e.target.value })} /></label>
          <label className="field"><span>{t('tx.category')}</span>
            <select value={r.category} onChange={e => change(x => { x.category = e.target.value })}>
              {draft.categories.map(c => <option key={c.id} value={c.id}>{categoryName(c, t)}</option>)}
            </select></label>
          <ul className="group-list">
            <Row label={t('settings.active')} toggle={{ on: r.enabled, onChange: on => change(x => { x.enabled = on }) }} />
          </ul>
          <div className="form-end cat-end">
            <button type="button" className="link-btn" onClick={() => { edit(s => { s.rules = rules.filter(x => x.id !== r.id) }); setOpen(null) }}>{t('rules.delete')}</button>
            <button type="button" className="btn primary" onClick={() => setOpen(null)}>{t('action.done')}</button>
          </div>
        </>}
      </Sheet>
    </section>
  )
}
