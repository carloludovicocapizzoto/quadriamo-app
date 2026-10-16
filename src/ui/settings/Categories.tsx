// Categorie: nome, tipo e parte in cui finiscono di solito (le entrate possono dividersi a modo proprio).
import { CUSTOM, DEFAULT_CATEGORIES, FIRST, type CategoryType } from '../../engine'
import { useI18n } from '../../i18n/core'
import { newId } from '../../store/state'
import { SplitEditor } from '../SplitEditor'
import { bucketName, categoryName } from '../names'
import type { SettingsDraft } from './draft'

const TYPES: CategoryType[] = ['expense', 'income', 'saving']
const DEFAULT_IDS = new Set(DEFAULT_CATEGORIES.map(c => c.id))

export function CategoriesSection({ d: { data, draft, edit } }: { d: SettingsDraft }) {
  const { t } = useI18n()
  function deleteCategory(id: string) {
    const used = data.transactions.filter(tx => tx.category === id).length
    if (used && !confirm(t('settings.deleteCategoryUsed', { n: used }))) return
    edit(s => {
      s.categories = s.categories.filter(c => c.id !== id)
      s.events = s.events.filter(e => e.category !== id)
    })
  }

  return (
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
                  {c.type === 'expense' && <option value={FIRST}>{t('bucket.first')}</option>}
        </select>
              : <select aria-label={t('settings.incomeTo')} value={c.defaultBucket ?? ''}
                   onChange={e => edit(s => {
                          s.categories[i].defaultBucket = e.target.value || null
                          // a modo mio: si parte dalla regola, così il totale è già 100%
                          if (e.target.value === CUSTOM && !s.categories[i].split) s.categories[i].split = Object.fromEntries(s.buckets.map(b => [b.id, b.share]))
                    })}>
                  <option value="">{t('split.rule')}</option>
                  {draft.buckets.map(b => <option key={b.id} value={b.id}>{t('split.all', { part: bucketName(b, t) })}</option>)}
                  <option value={CUSTOM}>{t('split.custom')}</option>
                </select>}
            <button className="icon-btn" aria-label={t('action.delete')} onClick={() => deleteCategory(c.id)}>×</button>
            {c.type === 'income' && c.defaultBucket === CUSTOM &&
              <SplitEditor buckets={draft.buckets} value={c.split} onChange={v => edit(s => { s.categories[i].split = v })} />}
          </li>
        ))}
      </ul>
      <button className="btn" onClick={() => edit(s => {
        s.categories.push({ id: newId(), name: t('settings.newCategory'), type: 'expense', defaultBucket: s.buckets[0].id })
      })}>+ {t('settings.addCategory')}</button>
      </section>
  )
}
