import { useState } from 'react'
import { useI18n } from '../i18n/core'
import { CURRENCIES, guessCurrency } from './names'

export function Onboarding({ onStart, onDemo }: { onStart: (currency: string, startDay: number) => void; onDemo: () => void }) {
  const { t } = useI18n()
  const [currency, setCurrency] = useState(guessCurrency)
  const [startDay, setStartDay] = useState(1)
  return (
    <section className="card onboarding">
      <h1>{t('onb.title')}</h1>
      <p className="lead">{t('onb.text')}</p>
      <p className="muted small">{t('app.rule')}</p>
      <label className="field">
        <span>{t('settings.currency')}</span>
        <select value={currency} onChange={e => setCurrency(e.target.value)}>
          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{t('settings.startDay')}</span>
        <input type="number" inputMode="numeric" min={1} max={28} value={startDay}
               onChange={e => setStartDay(Math.min(28, Math.max(1, Number(e.target.value) || 1)))} />
        <small className="muted">{t('settings.startDayHint')}</small>
      </label>
      <div className="stack">
        <button className="btn primary big-btn" onClick={() => onStart(currency, startDay)}>{t('onb.start')}</button>
        <button className="btn" onClick={onDemo}>{t('onb.demo')}</button>
      </div>
      <p className="muted small">🔒 {t('onb.privacy')}</p>
    </section>
  )
}
