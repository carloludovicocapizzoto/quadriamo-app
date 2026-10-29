// In cima al mese del calendario: un numero protagonista (quanto resta a fine mese, se è il mese in corso; altrimenti
// quanto esce), la linea di quanto è già pagato, e quattro cifre: entrate, uscite, già pagato, da pagare.
// Una delle poche superfici in vetro dell'app (Costituzione, 17/10): sta sopra lo sfondo della sezione come un foglio.
import type { CSSProperties } from 'react'
import type { PeriodSummary } from '../../engine'
import { useI18n } from '../../i18n/core'
import { Money } from '../kit/Money'

export function MonthSummary({ s, currency }: { s: PeriodSummary; currency: string }) {
  const { t, money } = useI18n()
  const paidShare = s.out > 0 ? s.paid / s.out : 0
  return (
    <section className="glass-card cal-summary" aria-label={t('cal.summary')}>
      <p className="cs-label">{t('cal.monthOut')}</p>
      <Money className="cs-hero" value={s.out} currency={currency} />
      {s.out > 0 && <div className="cs-bar" role="img" aria-label={t('cal.paidShare', { pct: Math.round(paidShare * 100) })}>
        <i style={{ '--w': paidShare } as CSSProperties} /></div>}
      <dl className="cs-grid">
        <div><dt>{t('cal.income')}</dt><dd className={s.income > 0 ? 'good-text' : undefined}><Money value={s.income} currency={currency} /></dd></div>
        <div><dt>{t('cal.outgoing')}</dt><dd><Money value={s.out} currency={currency} /></dd></div>
        <div><dt>{t('cal.paid')}</dt><dd><Money value={s.paid} currency={currency} /></dd></div>
        <div><dt>{t('cal.toPay')}</dt><dd><Money value={s.toPay} currency={currency} /></dd></div>
      </dl>
      {s.overdue > 0 && <p className="cs-late">{t('cal.overdueOf', { amount: money(s.overdue, currency) })}</p>}
    </section>
  )
}
