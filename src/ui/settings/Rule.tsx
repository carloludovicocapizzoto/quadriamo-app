// La regola: una riga per parte (nome e quota); nome, quota e saldo di partenza si cambiano nel pannello. Le quote fanno 100%.
import { useState } from 'react'
import { useI18n } from '../../i18n/core'
import { Icon } from '../Icon'
import { AmountInput } from '../kit/AmountInput'
import { decimalText, parseDecimal } from '../kit/decimal'
import { Money } from '../kit/Money'
import { Sheet } from '../kit/Sheet'
import { BUCKET_COLORS, bucketName } from '../names'
import type { SettingsDraft } from './draft'

// la quota in percentuale, con i decimali della lingua
const pct = (share: number, lang: string) => decimalText(Math.round(share * 1000) / 10, lang)

export function RuleSection({ d: { draft, edit, errors } }: { d: SettingsDraft }) {
  const { t, lang } = useI18n()
  const [shares, setShares] = useState(() => draft.buckets.map(b => pct(b.share, lang)))
  const [open, setOpen] = useState<number | null>(null)
  const total = Math.round(draft.buckets.reduce((a, b) => a + b.share, 0) * 1000) / 10
  const bad = errors.includes('sharesNot100')
  const check = (
    <p className={`group-foot ${bad ? 'bad-text' : 'good-text'}`}>
      <Icon name={bad ? 'alert' : 'check'} size={15} className="inline-ico" />
      {bad ? t('settings.ruleBad', { n: decimalText(total, lang) }) : t('settings.ruleOk')}
    </p>
  )
  const b = open == null ? null : draft.buckets[open]
  return (
    <section className="group">
      <h2 className="group-title">{t('settings.rule')}</h2>
      <p className="muted small group-intro">{t('settings.ruleHint')}</p>
      <ul className="group-list">
        {draft.buckets.map((x, i) => (
          <li key={x.id}><button type="button" className="row" onClick={() => setOpen(i)}>
            <i className="row-dot" style={{ background: BUCKET_COLORS[i] }} />
            <span className="row-main"><span>{bucketName(x, t)}</span>
              {!!x.startingBalance && <small>{t('settings.startingBalance')} <Money value={x.startingBalance} currency={draft.currency} /></small>}</span>
            <span className={`row-value row-strong${bad ? ' bad-text' : ''}`}>{shares[i] || '0'}%</span>
            <Icon name="chevron" size={18} className="row-chev" />
          </button></li>
        ))}
      </ul>
      {check}
      <Sheet open={b != null} onClose={() => setOpen(null)} title={b ? bucketName(b, t) : ''}>
        {b && open != null && <>
          <label className="field"><span>{t('settings.name')}</span>
            <input value={bucketName(b, t)} aria-invalid={!b.name.trim()} onChange={e => edit(s => { s.buckets[open].name = e.target.value || b.id })} /></label>
          <label className="field"><span>{t('settings.share')}</span>
            <input inputMode="decimal" value={shares[open]} aria-invalid={bad}
                   onChange={e => {
                     const v = e.target.value
                     setShares(prev => prev.map((x, j) => j === open ? v : x))
                     edit(s => { s.buckets[open].share = (parseDecimal(v) ?? 0) / 100 })
                   }} /></label>
          <label className="field"><span>{t('settings.startingBalance')}</span>
            <AmountInput key={b.id} defaultValue={b.startingBalance || null} onValue={n => edit(s => { s.buckets[open].startingBalance = n ?? 0 })} /></label>
          {check}
          <div className="form-end"><button className="btn primary" onClick={() => setOpen(null)}>{t('action.done')}</button></div>
        </>}
      </Sheet>
    </section>
  )
}
