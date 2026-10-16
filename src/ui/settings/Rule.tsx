// La regola: nome, quota e saldo di partenza di ciascuna parte (le quote fanno 100%).
import { useState } from 'react'
import { useI18n } from '../../i18n/core'
import { Icon } from '../Icon'
import { AmountInput } from '../kit/AmountInput'
import { parseAmount } from '../kit/amount'
import { BUCKET_COLORS, bucketName } from '../names'
import type { SettingsDraft } from './draft'

const pct = (share: number) => String(Math.round(share * 1000) / 10).replace('.', ',')

export function RuleSection({ d: { draft, edit, errors } }: { d: SettingsDraft }) {
  const { t } = useI18n()
  const [shares, setShares] = useState(() => draft.buckets.map(b => pct(b.share)))
  const total = Math.round(draft.buckets.reduce((a, b) => a + b.share, 0) * 1000) / 10
  return (
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
            <AmountInput aria-label={t('settings.startingBalance')} placeholder={t('settings.startingBalance')}
                   defaultValue={b.startingBalance || null} onValue={n => edit(s => { s.buckets[i].startingBalance = n ?? 0 })} />
      </div>
        ))}
      </div>
      <p className={errors.includes('sharesNot100') ? 'bad-text small' : 'good-text small'}>
        <Icon name={errors.includes('sharesNot100') ? 'alert' : 'check'} size={15} className="inline-ico" />
        {errors.includes('sharesNot100')
          ? t('settings.ruleBad', { n: String(total).replace('.', ',') }) : t('settings.ruleOk')}
      </p>
      </section>
  )
}
