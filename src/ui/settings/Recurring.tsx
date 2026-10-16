// Spese fisse: importo, categoria, giorno del mese e rate rimaste.
import { installmentsLeft, monthOf, todayIso, untilAfter } from '../../engine'
import { useI18n } from '../../i18n/core'
import { AmountInput } from '../kit/AmountInput'
import { categoryName } from '../names'
import type { SettingsDraft } from './draft'

export function RecurringSection({ d: { draft, edit } }: { d: SettingsDraft }) {
  const { t } = useI18n()
  const nowYm = monthOf(todayIso(), draft.monthStartDay)
  return (
    <section className="card">
      <h3 className="h-plain">{t('settings.recurring')}</h3>
      <p className="muted small">{t('settings.recurringHint')}</p>
      <ul className="edit-list recurring">
        {draft.recurring.map((r, i) => (
          <li key={i}>
            <input aria-label={t('settings.name')} value={r.name} aria-invalid={!r.name.trim()}
                   onChange={e => edit(s => { s.recurring[i].name = e.target.value })} />
            <label className="unit"><AmountInput aria-label={t('tx.amount')} defaultValue={r.amount || null}
                   aria-invalid={!(r.amount > 0)} placeholder="0,00" onValue={n => edit(s => { s.recurring[i].amount = n ?? 0 })} />
              <span aria-hidden>{draft.currency}</span></label>
              <select aria-label={t('tx.category')} value={r.category}
                    onChange={e => edit(s => { s.recurring[i].category = e.target.value })}>
              {draft.categories.filter(c => c.type !== 'income').map(c => <option key={c.id} value={c.id}>{categoryName(c, t)}</option>)}
        </select>
            <label className="unit"><input aria-label={t('settings.day')} type="number" inputMode="numeric" min={1} max={31} value={r.day ?? ''}
                   onChange={e => edit(s => { s.recurring[i].day = e.target.value ? Number(e.target.value) : null })} />
              <span aria-hidden>{t('settings.dayUnit')}</span></label>
            <label className="unit"><input aria-label={t('settings.left')} placeholder={t('settings.noEnd')} type="number" inputMode="numeric" min={0} max={600}
                   value={installmentsLeft(r, nowYm) ?? ''}
                   onChange={e => edit(s => { s.recurring[i].until = untilAfter(nowYm, e.target.value ? Number(e.target.value) : null) })} />
              {r.until && <span aria-hidden>{t('settings.leftUnit')}</span>}</label>
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
  )
}
