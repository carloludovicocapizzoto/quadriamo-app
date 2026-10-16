// Regole automatiche: una parola nella descrizione sceglie la categoria.
import { useState } from 'react'
import { seedRules } from '../../engine'
import { useI18n } from '../../i18n/core'
import { newId } from '../../store/state'
import { categoryName } from '../names'
import type { SettingsDraft } from './draft'

export function RulesSection({ d: { draft, edit } }: { d: SettingsDraft }) {
  const { t } = useI18n()
  const [showRules, setShowRules] = useState(false)
  const rules = draft.rules ?? seedRules()
  return (
    <section className="card">
      <h3 className="h-plain">{t('rules.title')}</h3>
      <p className="muted small">{t('rules.hint')}</p>
      <button className="link-btn" aria-expanded={showRules} onClick={() => setShowRules(!showRules)}>
        {showRules ? t('rules.hide') : t('rules.show', { n: rules.length })}</button>
      {showRules && (
        <ul className="edit-list rules-list">
          {rules.map((r, i) => (
            <li key={r.id}>
              <input aria-label={t('rules.keyword')} value={r.keyword} aria-invalid={!r.keyword.trim()}
                     onChange={e => edit(s => { s.rules = structuredClone(rules); s.rules[i].keyword = e.target.value })} />
              <select aria-label={t('tx.category')} value={r.category}
                      onChange={e => edit(s => { s.rules = structuredClone(rules); s.rules[i].category = e.target.value })}>
                {draft.categories.map(c => <option key={c.id} value={c.id}>{categoryName(c, t)}</option>)}
        </select>
              <label className="check"><input type="checkbox" checked={r.enabled}
                     onChange={e => edit(s => { s.rules = structuredClone(rules); s.rules[i].enabled = e.target.checked })} /> {t('settings.active')}</label>
              <button className="icon-btn" aria-label={t('action.delete')}
                      onClick={() => edit(s => { s.rules = rules.filter((_, j) => j !== i) })}>×</button>
          </li>
        ))}
      </ul>
      )}
      <button className="btn" onClick={() => { setShowRules(true); edit(s => {
        s.rules = [{ id: newId(), keyword: '', category: draft.categories.find(c => c.type === 'expense')?.id ?? '', paidFrom: null, enabled: true }, ...rules]
      }) }}>+ {t('rules.add')}</button>
      </section>
  )
}
