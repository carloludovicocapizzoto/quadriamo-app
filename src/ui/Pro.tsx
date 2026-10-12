import { useEffect, useState, type ReactNode } from 'react'
import { BETA_ALL_PRO, PRICE, askUpgrade, billingStatus, openPortal, previewFree, refreshPlan, setPreviewFree, startCheckout, usePlan, type ProFeature } from '../billing/plan'
import { useI18n } from '../i18n/core'
import type { Dict } from '../i18n/en'
import { useSync } from '../sync/context'
import { Icon } from './Icon'

/** Mostra il contenuto solo con Pro; altrimenti un invito sobrio a passare a Pro. */
export function ProGate({ feature, children, compact = false }: { feature: ProFeature; children: ReactNode; compact?: boolean }) {
  const plan = usePlan()
  if (plan.pro || plan.loading) return <>{children}</>
  return <Paywall feature={feature} compact={compact} />
}

function Paywall({ feature, compact }: { feature: ProFeature; compact: boolean }) {
  const { t } = useI18n()
  if (compact) return (
    <div className="paywall compact">
      <span className="pro-badge">Pro</span>
      <p><b>{t(`pro.f.${feature}` as keyof Dict)}</b></p>
      <button className="btn small-btn primary" onClick={askUpgrade}>{t('pro.discover')}<Icon name="chevron" size={16} /></button>
    </div>
  )
  return (
    <section className="card paywall-page">
      <span className="paywall-ico"><Icon name={feature === 'investments' ? 'growth' : feature === 'shared' ? 'users' : 'chart'} size={28} /></span>
      <span className="pro-badge">Pro</span>
      <h2>{t(`pro.f.${feature}` as keyof Dict)}</h2>
      <p className="muted">{t(`pro.f.${feature}D` as keyof Dict)}</p>
      <button className="btn primary" onClick={askUpgrade}>{t('pro.discover')}<Icon name="chevron" size={16} /></button>
    </section>
  )
}

/** Opzioni → Il tuo piano: Free/Pro, prezzi, pagamento e gestione dell'abbonamento. */
export function PlanCard({ onLogin }: { onLogin: () => void }) {
  const { t, money, date } = useI18n()
  const sync = useSync()
  const plan = usePlan()
  const [interval, setIv] = useState<'month' | 'year'>('year')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [test, setTest] = useState<boolean | null>(null)
  useEffect(() => { void billingStatus().then(s => setTest(s.configured ? !!s.test : null)) }, [])
  const paid = !!plan.sub && ['active', 'trialing', 'past_due'].includes(plan.sub.status)
  const save = Math.round((1 - PRICE.year / (PRICE.month * 12)) * 100)

  async function go(fn: () => Promise<void>) {
    setBusy(true); setErr('')
    try { await fn() } catch (e) { setErr(e instanceof Error && e.message === 'not configured' ? t('pro.notReady') : t('pro.error')) } finally { setBusy(false) }
  }
  return (
    <section className="card plan" id="plan">
      <div className="plan-head"><h3 className="h-plain">{t('pro.title')}</h3>
        <span className={`pro-badge${plan.pro ? '' : ' free'}`}>{plan.pro ? 'Pro' : 'Free'}</span></div>

      {paid && plan.sub && <>
        <p>{t(plan.sub.cancel_at_period_end ? 'pro.endsOn' : 'pro.renewsOn', { date: plan.sub.current_period_end ? date(plan.sub.current_period_end.slice(0, 10)) : '—' })}
          {' · '}{t(plan.sub.interval === 'year' ? 'pro.yearly' : 'pro.monthly')}</p>
        {!plan.sub.livemode && <p className="small muted">{t('pro.testMode')}</p>}
        <button className="btn" disabled={busy} onClick={() => void go(openPortal)}><Icon name="settings" size={16} />{t('pro.manage')}</button>
      </>}

      {!paid && <>
        {plan.beta && <p className="good-text small"><Icon name="check" size={15} />{t('pro.betaFree')}</p>}
        <ul className="pro-list">
          {(['reports', 'investments', 'shared'] as const).map(f => <li key={f}><Icon name="check" size={16} /><span><b>{t(`pro.f.${f}` as keyof Dict)}</b><small className="muted">{t(`pro.f.${f}D` as keyof Dict)}</small></span></li>)}
        </ul>
        <div className="seg" role="radiogroup" aria-label={t('pro.title')}>
          {(['year', 'month'] as const).map(i => (
            <button key={i} role="radio" aria-checked={interval === i} className={interval === i ? 'on' : ''} onClick={() => setIv(i)}>
              <b>{money(i === 'year' ? PRICE.year : PRICE.month, PRICE.currency)}</b>
              <small>{t(i === 'year' ? 'pro.perYear' : 'pro.perMonth')}{i === 'year' && save > 0 ? ` · −${save}%` : ''}</small>
            </button>))}
        </div>
        {sync.user
          ? <button className="btn primary big-btn wide" disabled={busy} onClick={() => void go(() => startCheckout(interval))}>
              {busy ? t('pro.opening') : t('pro.upgrade')}</button>
          : <button className="btn primary wide" onClick={onLogin}><Icon name="user" size={16} />{t('pro.needAccount')}</button>}
        {test && <p className="small muted">{t('pro.testHint')}</p>}
      </>}
      {err && <p className="small bad-text">{err}</p>}
      {BETA_ALL_PRO && sync.user && (
        <label className="check top-gap small">
          <input type="checkbox" defaultChecked={previewFree()} onChange={e => { setPreviewFree(e.target.checked); refreshPlan() }} />
          {t('pro.preview')}
        </label>)}
    </section>
  )
}
