import { useState } from 'react'
import { LANGS, useI18n, type Lang } from '../i18n/core'
import { useSync } from '../sync/context'
import { isStandalone } from '../beta/device'
import { installSkip } from '../sync/profile'
import { LoginScreen } from './AccountSection'
import { InstallTutorial } from './InstallTutorial'
import { Icon } from './Icon'
import { LegalLinks } from './LegalLinks'

/** Il logo di Quadriamo: i quattro blocchi compaiono uno dopo l'altro. */
export function LogoMark({ size = 96 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#17181A" className="lm-bg" />
      <rect x="13" y="13" width="20" height="18" rx="2" fill="#C2410C" className="lm lm1" />
      <rect x="36" y="13" width="15" height="18" rx="2" fill="#E8915F" className="lm lm2" />
      <rect x="13" y="34" width="20" height="17" rx="2" fill="#D9BE9A" className="lm lm3" />
      <rect x="36" y="34" width="15" height="17" rx="2" fill="#8C8F94" className="lm lm4" />
    </svg>
  )
}

/** Mentre l'app si avvia: solo il logo. */
export function Splash() {
  return <div className="gate gate-splash"><LogoMark size={84} /></div>
}

/**
 * Ingresso nell'app quando non hai fatto l'accesso: pagina di benvenuto con logo e colori, poi il riquadro
 * "Accedi / Crea account" (con password dimenticata). Dopo, la configurazione a passaggi e infine l'app.
 */
export function Gate({ hasData, onLocal, onDemo }: { hasData: boolean; onLocal: () => void; onDemo: () => void }) {
  const { t, lang, setLang } = useI18n()
  const sync = useSync()
  const [phase, setPhase] = useState<'welcome' | 'install' | 'login'>('welcome')
  const [leaving, setLeaving] = useState(false)
  // aperta dal browser (non ancora installata): prima il tutorial per aggiungerla alla Home, poi l'accesso
  const needsInstall = !isStandalone() && !installSkip.get()
  const go = () => {
    if (!sync.enabled && !needsInstall) { onLocal(); return }
    setLeaving(true)
    setTimeout(() => { setPhase(needsInstall ? 'install' : 'login'); setLeaving(false) }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380)
  }
  const afterInstall = () => { installSkip.set(); if (sync.enabled) setPhase('login'); else onLocal() }
  const langSelect = (
    <select className="lang gate-lang" value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label={t('lang.label')}>
      {Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
    </select>
  )

  if (phase === 'welcome') {
    return (
      <div className={`gate gate-welcome${leaving ? ' leaving' : ''}`}>
        {langSelect}
          <div className="gate-hero">
          <LogoMark />
          <h1 className="gate-word">Quadriamo<span>.</span></h1>
          <p className="gate-tag">{t('app.tagline')}</p>
          <p className="gate-sub">{t('gate.sub')}</p>
          <div className="gate-rule" aria-hidden="true">
            <span style={{ flex: 55 }} /><span style={{ flex: 20 }} /><span style={{ flex: 15 }} /><span style={{ flex: 10 }} />
          </div>
          <button className="btn primary big-btn gate-cta" onClick={go}>{t('gate.start')}<Icon name="chevron" size={16} /></button>
        </div>
      </div>
    )
  }

  if (phase === 'install') {
    return (
      <div className="gate gate-login">
        {langSelect}
          <div className="gate-panel"><section className="card"><InstallTutorial onContinue={afterInstall} /></section></div>
      </div>
    )
  }

  return (
    <div className="gate gate-login">
      {langSelect}
      <div className="gate-panel">
        <LoginScreen footer={<>
          {hasData ? <small className="muted">{t('gate.keepData')}</small>
            : <button className="link-btn" onClick={onDemo}>{t('onb.demo')}</button>}
          <LegalLinks notice />
        </>} />
      </div>
    </div>
  )
}

/** Aperta dal pulsante dell'email di conferma (quindi nel browser): l'account è attivo, si torna sull'app installata. */
export function ConfirmedScreen({ onContinue }: { onContinue: () => void }) {
  const { t } = useI18n()
  return (
    <div className="gate gate-login">
      <div className="gate-panel">
        <section className="card confirmed">
          <div className="ready-check"><svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><path d="M13 25l7 7 15-16" /></svg></div>
          <h1>{t('conf.title')}</h1>
          <p className="muted">{t('conf.sub')}</p>
          <ol className="conf-steps">
            <li><span className="n">1</span><div><b>{t('conf.s1')}</b><p className="small muted">{t('conf.s1d')}</p></div>
              <span className="conf-icon"><LogoMark size={44} /></span></li>
            <li><span className="n">2</span><div><b>{t('conf.s2')}</b><p className="small muted">{t('conf.s2d')}</p></div>
              <span className="conf-login">{t('auth.tabSignIn')}</span></li>
          </ol>
          <button className="link-btn" onClick={onContinue}>{t('conf.here')}<Icon name="chevron" size={16} /></button>
        </section>
      </div>
    </div>
  )
}
