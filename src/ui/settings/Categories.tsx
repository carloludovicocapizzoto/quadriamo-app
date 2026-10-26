// Categorie: nome, tipo e parte in cui finiscono di solito (le entrate possono dividersi a modo proprio).
import { useState } from 'react'
import { CUSTOM, DEFAULT_CATEGORIES, FIRST, type Category, type CategoryType } from '../../engine'
import { useI18n } from '../../i18n/core'
import { categoryUsage, deleteCategory, moveTargets, usageTotal, type CategoryUsage } from '../../store/categories'
import { useStore } from '../../store/context'
import { newId } from '../../store/state'
import { SplitEditor } from '../SplitEditor'
import { bucketName, categoryName } from '../names'
import type { SettingsDraft } from './draft'

const TYPES: CategoryType[] = ['expense', 'income', 'saving']
const DEFAULT_IDS = new Set(DEFAULT_CATEGORIES.map(c => c.id))

export function CategoriesSection({ d: { data, draft, edit, reset, flash } }: { d: SettingsDraft }) {
  const { t } = useI18n()
  const { dispatch } = useStore()
  // la categoria che si sta eliminando (pannello di conferma nella sua riga) e dove spostare ciò che la usa
  const [deleting, setDeleting] = useState<string | null>(null)
  const [target, setTarget] = useState('')
  const ask = (id: string) => { setDeleting(id); setTarget(moveTargets(data, id)[0]?.id ?? '') }
  function confirmDelete(id: string) {
    const used = usageTotal(categoryUsage(data, id)) > 0, at = new Date().toISOString()
    const next = deleteCategory(data, id, used ? target : null, at)
    if (!next) return
    dispatch({ type: 'deleteCategory', id, moveTo: used ? target : null, at })
    reset(next.settings); setDeleting(null); flash(t('settings.saved'))
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
            <button className="icon-btn" aria-label={t('action.delete')} aria-expanded={deleting === c.id} onClick={() => deleting === c.id ? setDeleting(null) : ask(c.id)}>×</button>
            {c.type === 'income' && c.defaultBucket === CUSTOM &&
              <SplitEditor buckets={draft.buckets} value={c.split} onChange={v => edit(s => { s.categories[i].split = v })} />}
            {deleting === c.id && <DeletePanel name={categoryName(c, t)} usage={categoryUsage(data, c.id)} targets={moveTargets(data, c.id)}
              target={target} onTarget={setTarget} onConfirm={() => confirmDelete(c.id)} onCancel={() => setDeleting(null)} />}
          </li>
        ))}
      </ul>
      <button className="btn" onClick={() => edit(s => {
        s.categories.push({ id: newId(), name: t('settings.newCategory'), type: 'expense', defaultBucket: s.buckets[0].id })
      })}>+ {t('settings.addCategory')}</button>
      </section>
  )
}

/** Prima di eliminare: cosa usa la categoria e dove finirà. Niente si cancella in silenzio. */
function DeletePanel({ name, usage, targets, target, onTarget, onConfirm, onCancel }: {
  name: string; usage: CategoryUsage; targets: Category[]; target: string
  onTarget: (id: string) => void; onConfirm: () => void; onCancel: () => void
}) {
  const { t } = useI18n()
  const used = usageTotal(usage) > 0
  const rows = ([['transactions', 'settings.usageTransactions'], ['events', 'settings.usageEvents'], ['rules', 'settings.usageRules'],
    ['inbox', 'settings.usageInbox']] as const).filter(([k]) => usage[k] > 0)
  return (
    <div className="cat-delete" role="group" aria-label={t('settings.deleteAsk', { name })}>
      <p><b>{t('settings.deleteAsk', { name })}</b></p>
      {used ? <>
        <p className="small cat-uses">{rows.map(([k, label]) => <span key={k}>{t(label, { n: usage[k] })}</span>)}</p>
        <p className="small muted">{t('settings.deleteMoves')}</p>
        {targets.length ? <label className="field"><span>{t('settings.moveTo')}</span>
          <select value={target} onChange={e => onTarget(e.target.value)}>
            {targets.map(c => <option key={c.id} value={c.id}>{categoryName(c, t)}</option>)}
          </select></label>
          : <p className="small bad-text" role="alert">{t('settings.noMoveTarget')}</p>}
      </> : <p className="small muted">{t('settings.deleteUnused')}</p>}
      <div className="stack-row">
        <button className="btn danger" disabled={used && !targets.length} onClick={onConfirm}>{t(used ? 'settings.moveAndDelete' : 'action.delete')}</button>
        <button className="btn" onClick={onCancel}>{t('action.cancel')}</button>
      </div>
    </div>
  )
}
