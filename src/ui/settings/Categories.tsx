// Categorie: una riga per categoria, divise per tipo, con la parte in cui finiscono di solito; il pannello cambia nome, tipo e parte
// (le entrate possono dividersi a modo proprio) ed elimina, dicendo prima cosa la usa.
import { useState } from 'react'
import { CUSTOM, DEFAULT_CATEGORIES, FIRST, type Category, type CategoryType } from '../../engine'
import { useI18n } from '../../i18n/core'
import { categoryUsage, deleteCategory, moveTargets, usageTotal, type CategoryUsage } from '../../store/categories'
import { useStore } from '../../store/context'
import { newId } from '../../store/state'
import { Icon } from '../Icon'
import { SplitEditor } from '../SplitEditor'
import { Segmented } from '../kit/Segmented'
import { Sheet } from '../kit/Sheet'
import { BUCKET_COLORS, bucketName, categoryName } from '../names'
import type { SettingsDraft } from './draft'

const TYPES: CategoryType[] = ['income', 'expense', 'saving']
const DEFAULT_IDS = new Set(DEFAULT_CATEGORIES.map(c => c.id))

export function CategoriesSection({ d: { data, draft, edit, reset, flash } }: { d: SettingsDraft }) {
  const { t } = useI18n()
  const { dispatch } = useStore()
  // la categoria aperta nel pannello; quella che si sta eliminando e dove spostare ciò che la usa
  const [open, setOpen] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [target, setTarget] = useState('')
  const ask = (id: string) => { setDeleting(id); setTarget(moveTargets(data, id)[0]?.id ?? '') }
  const close = () => { setOpen(null); setDeleting(null) }
  function confirmDelete(id: string) {
    const used = usageTotal(categoryUsage(data, id)) > 0, at = new Date().toISOString()
    const next = deleteCategory(data, id, used ? target : null, at)
    if (!next) return
    dispatch({ type: 'deleteCategory', id, moveTo: used ? target : null, at })
    reset(next.settings); close(); flash(t('settings.saved'))
  }
  // dove va di solito: la parte (spese e risparmi) o come si divide (entrate)
  const where = (c: Category) => {
    const b = draft.buckets.find(x => x.id === c.defaultBucket)
    if (c.type === 'income') return c.defaultBucket === CUSTOM ? t('split.custom') : b ? t('split.all', { part: bucketName(b, t) }) : t('split.rule')
    return c.defaultBucket === FIRST ? t('bucket.first') : b ? bucketName(b, t) : ''
  }
  const color = (c: Category) => {
    const i = draft.buckets.findIndex(x => x.id === c.defaultBucket)
    return c.type !== 'income' && i >= 0 ? BUCKET_COLORS[i] : undefined
  }
  const i = draft.categories.findIndex(c => c.id === open)
  const c = i >= 0 ? draft.categories[i] : null
  const choose = (v: string) => edit(s => {
    const x = s.categories[i]
    x.defaultBucket = v || null
    // a modo mio: si parte dalla regola, così il totale è già 100%
    if (v === CUSTOM && !x.split) x.split = Object.fromEntries(s.buckets.map(b => [b.id, b.share]))
  })
  const choices = !c ? [] : c.type === 'income'
    ? [{ id: '', label: t('split.rule') }, ...draft.buckets.map(b => ({ id: b.id, label: t('split.all', { part: bucketName(b, t) }) })), { id: CUSTOM, label: t('split.custom') }]
    : [...draft.buckets.map((b, j) => ({ id: b.id, label: bucketName(b, t), color: BUCKET_COLORS[j] })), ...(c.type === 'expense' ? [{ id: FIRST, label: t('bucket.first') }] : [])]

  return (<>
    {TYPES.map(ty => {
      const list = draft.categories.filter(x => x.type === ty)
      if (!list.length && ty !== 'expense') return null
      return (
        <section className="group" key={ty}>
          <h2 className="group-title">{t('settings.categories')} · {t(`type.${ty}`)}</h2>
          <ul className="group-list cat-list">
            {list.map(x => (
              <li key={x.id}><button type="button" className="row" onClick={() => setOpen(x.id)}>
                {ty !== 'income' && <i className="row-dot" style={{ background: color(x) ?? 'var(--fill-2)' }} />}
                <span className="row-main"><span className={x.name.trim() ? '' : 'bad-text'}>{categoryName(x, t) || '—'}</span></span>
                <span className="row-value">{where(x)}</span>
                <Icon name="chevron" size={18} className="row-chev" />
              </button></li>
            ))}
            {ty === 'expense' && <li><button type="button" className="row" onClick={() => {
              const id = newId()
              edit(s => { s.categories.push({ id, name: t('settings.newCategory'), type: 'expense', defaultBucket: s.buckets[0].id }) })
              setOpen(id)
            }}><span className="row-main"><span className="add-row">+ {t('settings.addCategory')}</span></span></button></li>}
          </ul>
        </section>
      )
    })}
    <Sheet open={!!c} onClose={close} title={c ? categoryName(c, t) || t('settings.newCategory') : ''}>
      {c && <div className="cat-sheet">
        <label className="field"><span>{t('settings.name')}</span>
          <input value={categoryName(c, t)} aria-invalid={!c.name.trim()}
                 onChange={e => edit(s => { s.categories[i].name = e.target.value || (DEFAULT_IDS.has(c.id) ? c.id : '') })} /></label>
        <div className="field"><span>{t('settings.type')}</span>
          <Segmented role="radiogroup" label={t('settings.type')} value={c.type} options={TYPES.map(ty => ({ id: ty, label: t(`type.${ty}`) }))}
            onChange={ty => edit(s => {
              s.categories[i].type = ty
              s.categories[i].defaultBucket = ty === 'income' ? null : (s.categories[i].defaultBucket && s.categories[i].defaultBucket !== CUSTOM ? s.categories[i].defaultBucket : s.buckets[0].id)
              if (ty === 'saving' && s.categories[i].defaultBucket === FIRST) s.categories[i].defaultBucket = s.buckets[0].id
            })} /></div>
        <div className="field"><span>{t(c.type === 'income' ? 'settings.incomeTo' : 'settings.bucket')}</span>
          <ul className="group-list" role="radiogroup" aria-label={t(c.type === 'income' ? 'settings.incomeTo' : 'settings.bucket')}>
            {choices.map(o => {
              const on = (c.defaultBucket ?? '') === o.id
              return <li key={o.id}><button type="button" className="row" role="radio" aria-checked={on} onClick={() => { if (!on) choose(o.id) }}>
                {'color' in o && <i className="row-dot" style={{ background: o.color }} />}
                <span className="row-main"><span>{o.label}</span></span>
                {on && <Icon name="check" size={18} className="row-check" />}
              </button></li>
            })}
          </ul>
          {c.type === 'income' && c.defaultBucket === CUSTOM &&
            <SplitEditor buckets={draft.buckets} value={c.split} onChange={v => edit(s => { s.categories[i].split = v })} />}
        </div>
        {deleting === c.id
          ? <DeletePanel name={categoryName(c, t)} usage={categoryUsage(data, c.id)} targets={moveTargets(data, c.id)}
              target={target} onTarget={setTarget} onConfirm={() => confirmDelete(c.id)} onCancel={() => setDeleting(null)} />
          : <div className="form-end cat-end">
              <button type="button" className="link-btn bad-text" onClick={() => ask(c.id)}>{t('settings.deleteCategory')}</button>
              <button type="button" className="btn primary" onClick={close}>{t('action.done')}</button>
            </div>}
      </div>}
    </Sheet>
  </>)
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
