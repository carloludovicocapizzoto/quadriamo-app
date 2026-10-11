import { useState, type FormEvent, type ReactNode } from 'react'
import { PAGES } from '../config'
import { ENTRY } from '../entry'
import { useI18n } from '../i18n/core'
import { useStore } from '../store/context'
import { useSync } from '../sync/context'
import { profilePrompt, setupPending } from '../sync/profile'
import { ProfileForm } from './ProfileForm'
import { StepHeader, StepNav } from './Steps'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type Msg = { text: string; bad?: boolean } | null

/** Riquadro account nelle Impostazioni: stato dell'accesso; se non hai fatto l'accesso, un pulsante che apre la schermata di accesso. */
export function AccountSection({ onLogin }: { onLogin?: () => void }) {
  const { t } = useI18n()
  const sync = useSync()
  if (!sync.enabled) return null
  const body = sync.recovery ? <NewPassword /> : sync.user ? <SignedIn /> : (
    <><p className="muted small">{t('auth.intro')}</p>
      <button className="btn primary" onClick={onLogin}>👤 {t('onb.account')}</button></>)
  return <section className="card" id="account"><h3 className="h-plain">{t('sync.title')}</h3>{body}</section>
}

/** Schermata di accesso: solo "Accedi / Crea account" (con password dimenticata). Niente impostazioni qui. */
export function LoginScreen({ footer }: { footer?: ReactNode }) {
  const { t } = useI18n()
  const sync = useSync()
  return (
    <section className="card login-screen">
      <h1>{t('onb.accountTitle')}</h1>
      {sync.recovery ? <NewPassword /> : <SignInOrUp />}
      {footer && <div className="login-foot">{footer}</div>}
    </section>
  )
}

function useRun() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const run = async (fn: () => Promise<void>, onError: (e: { code?: string; message?: string }) => string) => {
    setBusy(true); setMsg(null)
    try { await fn() } catch (e) { setMsg({ text: onError(e as { code?: string }), bad: true }) } finally { setBusy(false) }
  }
  return { busy, msg, setMsg, run }
}

function PasswordInput({ value, onChange, autoComplete, autoFocus }: { value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean }) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  return (
    <span className="pw">
      <input type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={e => onChange(e.target.value)} autoFocus={autoFocus} />
      <button type="button" className="link-btn" onClick={() => setShow(!show)}>{show ? t('auth.hide') : t('auth.show')}</button>
    </span>
  )
}

function SignInOrUp() {
  const { t, lang } = useI18n()
  const sync = useSync()
  const hasData = !!useStore().state.data
  // ?signup=1 ("Crea il tuo account" sul sito) apre direttamente la registrazione
  const [tab, setTab] = useState<'in' | 'up' | 'link' | 'confirm' | 'reset'>(ENTRY.get('signup') === '1' ? 'up' : 'in')
  const [step, setStep] = useState(1)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accept, setAccept] = useState(false)
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const { busy, msg, setMsg, run } = useRun()
  const em = email.trim()
  const bad = (text: string) => { setMsg({ text, bad: true }); return false }
  const next = () => { setMsg(null); setStep(step + 1) }
  const back = () => { setMsg(null); setStep(step - 1) }
  const go = (x: typeof tab) => { setTab(x); setStep(1); setMsg(null) }

  // registrazione: 1 nome e cognome · 2 email · 3 password e consenso
  const signUp = (e: FormEvent) => {
    e.preventDefault()
    if (step === 1) { if (!first.trim() || !last.trim()) return bad(t('auth.errName')); return next() }
    if (step === 2) { if (!EMAIL.test(em)) return bad(t('sync.errEmail')); return next() }
    if (password.length < 8) return bad(t('auth.errPassword'))
    if (!accept) return bad(t('auth.errAccept'))
    void run(async () => {
      const r = await sync.signUp({ firstName: first.trim(), lastName: last.trim(), email: em, password, lang })
      // nuovo account: configurazione iniziale a passaggi (se su questo dispositivo non c'è già un budget) e profilo
      if (!hasData) setupPending.set(); else profilePrompt.set()
      if (r.needsConfirm) { setTab('confirm'); setCode('') }
    }, e => (e.code === 'user_already_exists' ? t('auth.errExists') : e.code === 'weak_password' ? t('auth.errPassword') : t('auth.errGeneric')))
  }
  // accesso: 1 email · 2 password
  const signIn = (e: FormEvent) => {
    e.preventDefault()
    if (step === 1) { if (!EMAIL.test(em)) return bad(t('sync.errEmail')); return next() }
    void run(() => sync.signIn(em, password), () => t('auth.errLogin'))
  }
  const forgot = () => void run(async () => { await sync.resetPassword(em); setCode(''); setTab('reset') }, () => t('auth.errGeneric'))
  // codice di 6 cifre dell'email: si conferma restando nell'app (il pulsante dell'email aprirebbe il browser)
  const confirmSignup = (e: FormEvent) => { e.preventDefault(); void run(() => sync.verifySignup(em, code.trim()), () => t('sync.errCode')) }
  const confirmReset = (e: FormEvent) => { e.preventDefault(); void run(() => sync.verifyRecovery(em, code.trim()), () => t('sync.errCode')) }
  const codeInput = <input className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} placeholder="••••••"
    onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
  const sendLink = (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL.test(em)) { bad(t('sync.errEmail')); return }
    void run(async () => { await sync.sendCode(em); setCodeSent(true) }, () => t('sync.errSend'))
  }
  const verify = (e: FormEvent) => { e.preventDefault(); void run(() => sync.verifyCode(em, code.trim()), () => t('sync.errCode')) }
  // il cursore si sposta da solo solo dal secondo passaggio: all'apertura la pagina non scorre e la tastiera non si apre
  const emailInput = <input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus={step > 1} />

  return (
    <>
      <p className="muted small">{t('auth.intro')}</p>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'in' || tab === 'link' || tab === 'reset'} className={tab === 'in' || tab === 'link' || tab === 'reset' ? 'on' : ''} onClick={() => go('in')}>{t('auth.tabSignIn')}</button>
        <button role="tab" aria-selected={tab === 'up' || tab === 'confirm'} className={tab === 'up' || tab === 'confirm' ? 'on' : ''} onClick={() => go('up')}>{t('auth.tabSignUp')}</button>
      </div>

      {tab === 'up' && (
        <form onSubmit={signUp} className="auth-form" noValidate>
          <StepHeader n={step} total={3} title={[t('auth.stepName'), t('auth.stepEmail'), t('auth.stepPassword')][step - 1]} />
          <div className="step-body" key={step}>
            {step === 1 && <div className="two-col">
              <label className="field"><span>{t('auth.firstName')}</span><input autoComplete="given-name" maxLength={80} value={first} onChange={e => setFirst(e.target.value)} /></label>
              <label className="field"><span>{t('auth.lastName')}</span><input autoComplete="family-name" maxLength={80} value={last} onChange={e => setLast(e.target.value)} /></label>
            </div>}
            {step === 2 && <label className="field"><span>{t('sync.email')}</span>{emailInput}<small className="muted">{t('auth.stepEmailHint')}</small></label>}
            {step === 3 && <>
              <label className="field"><span>{t('auth.password')}</span><PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
                <small className="muted">{t('auth.passwordHint')}</small></label>
              <label className="check wrap-text"><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} />
                <span>{t('auth.accept')} (<a href={`${PAGES.terms}?lang=${lang}`} target="_blank" rel="noopener">{t('legal.terms')}</a>,{' '}
                  <a href={`${PAGES.privacy}?lang=${lang}`} target="_blank" rel="noopener">{t('legal.privacy')}</a>)</span></label>
            </>}
          </div>
          <StepNav onBack={step > 1 ? back : undefined} next={step < 3 ? `${t('step.next')} →` : t('auth.signUp')} busy={busy} />
        </form>
      )}

      {tab === 'in' && (
        <form onSubmit={signIn} className="auth-form" noValidate>
          <StepHeader n={step} total={2} title={step === 1 ? t('auth.stepSignInEmail') : t('auth.stepSignInPassword')} />
          <div className="step-body" key={step}>
            {step === 1 && <label className="field"><span>{t('sync.email')}</span>{emailInput}</label>}
            {step === 2 && <label className="field"><span>{t('auth.password')}</span>
              <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" autoFocus /></label>}
          </div>
          <StepNav onBack={step > 1 ? back : undefined} next={step === 1 ? `${t('step.next')} →` : t('auth.signIn')} busy={busy} />
          <div className="stack-row">
            {step === 2 && <button type="button" className="link-btn" disabled={busy} onClick={forgot}>{t('auth.forgot')}</button>}
            <button type="button" className="link-btn" onClick={() => go('link')}>{t('auth.useLink')}</button>
          </div>
        </form>
      )}

      {tab === 'confirm' && (
        <form onSubmit={confirmSignup} className="auth-form step-body" noValidate>
          <h4 className="step-title">✉️ {t('auth.confirmTitle')}</h4>
          <p className="small">{t('auth.confirmCode', { email: em })}</p>
          <label className="field"><span>{t('sync.code')}</span>{codeInput}</label>
          <div className="step-nav"><button className="btn primary" disabled={busy || code.length < 6}>{t('auth.confirm')}</button>
            <button type="button" className="link-btn" disabled={busy}
              onClick={() => void run(async () => { await sync.resendSignup(em); setMsg({ text: t('auth.resent') }) }, () => t('auth.errGeneric'))}>{t('auth.resend')}</button></div>
          <p className="muted small top-gap">{t('auth.confirmLinkHint')} <button type="button" className="link-btn" onClick={() => go('in')}>{t('auth.goSignIn')}</button></p>
        </form>
      )}

      {tab === 'reset' && (
        <form onSubmit={confirmReset} className="auth-form step-body" noValidate>
          <h4 className="step-title">🔑 {t('auth.resetTitle')}</h4>
          <p className="small">{t('auth.resetCode', { email: em })}</p>
          <label className="field"><span>{t('sync.code')}</span>{codeInput}</label>
          <div className="step-nav"><button className="btn primary" disabled={busy || code.length < 6}>{t('step.next')} →</button>
            <button type="button" className="link-btn" onClick={() => go('in')}>← {t('step.back')}</button></div>
        </form>
      )}

      {tab === 'link' && (!codeSent ? (
        <form onSubmit={sendLink} className="auth-form">
          <label className="field"><span>{t('sync.email')}</span>{emailInput}</label>
          <button className="btn primary" disabled={busy}>{t('sync.sendCode')}</button>
          <button type="button" className="link-btn" onClick={() => go('in')}>{t('auth.usePassword')}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="auth-form">
          <p className="small">{t('sync.codeSent', { email: em })}</p>
          <label className="field"><span>{t('sync.code')}</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus /></label>
          <div className="stack-row">
            <button className="btn primary" disabled={busy || code.length < 6}>{t('sync.verify')}</button>
            <button type="button" className="btn" onClick={() => { setCodeSent(false); setCode(''); setMsg(null) }}>{t('sync.changeEmail')}</button>
          </div>
        </form>
      ))}
      {msg && <p className={msg.bad ? 'bad-text small' : 'good-text small'} role="alert">{msg.text}</p>}
    </>
  )
}

function NewPassword() {
  const { t } = useI18n()
  const sync = useSync()
  const [password, setPassword] = useState('')
  const { busy, msg, setMsg, run } = useRun()
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setMsg({ text: t('auth.errPassword'), bad: true }); return }
    void run(async () => { await sync.updatePassword(password); setMsg({ text: t('auth.passwordSaved') }) }, () => t('auth.errGeneric'))
  }
  return (
    <form onSubmit={save} className="auth-form">
      <label className="field"><span>{t('auth.newPassword')}</span><PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
        <small className="muted">{t('auth.passwordHint')}</small></label>
      <button className="btn primary" disabled={busy}>{t('auth.savePassword')}</button>
      {msg && <p className={msg.bad ? 'bad-text small' : 'good-text small'} role="alert">{msg.text}</p>}
    </form>
  )
}

function SignedIn() {
  const { t, date } = useI18n()
  const sync = useSync()
  const { state } = useStore()
  const [profile, setProfile] = useState(() => profilePrompt.get())
  const [changePw, setChangePw] = useState(false)
  const { msg, setMsg, run } = useRun()
  const user = sync.user!
  const time = sync.lastSync
    ? `${date(sync.lastSync.slice(0, 10))} ${new Date(sync.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : null
  const statusText = {
    idle: '', syncing: t('sync.syncing'), ok: time ? t('sync.lastSync', { time }) : t('sync.ok'),
    offline: t('sync.offline'), error: t('sync.error'),
  }[sync.status] || (time ? t('sync.lastSync', { time }) : t('sync.never'))
  return (
    <>
      {user.firstName && <p className="hello">{t('auth.hello', { name: user.firstName })}</p>}
      <p>{t('sync.signedInAs', { email: user.email })}</p>
      <p className={`small ${sync.status === 'error' ? 'bad-text' : 'muted'}`} role="status">
        <span className={`dot ${sync.status}`} aria-hidden="true" /> {statusText}</p>
      {state.data?.demo && <p className="muted small">{t('sync.demoHint')}</p>}

      {profile && state.data
        ? <div className="profile-box"><h4>{t('prof.title')}</h4><ProfileForm onDone={() => setProfile(false)} /></div>
        : <button className="btn top-gap" onClick={() => setProfile(true)}>👤 {t('prof.edit')}</button>}

      {changePw && <div className="profile-box"><NewPassword /></div>}
      <div className="stack-row top-gap">
        <button className="btn" disabled={sync.status === 'syncing'} onClick={() => void sync.syncNow()}>{t('sync.now')}</button>
        {!changePw && <button className="btn" onClick={() => setChangePw(true)}>{t('auth.changePassword')}</button>}
        <button className="btn" onClick={() => void sync.signOut()}>{t('sync.signOut')}</button>
        <button className="btn danger" onClick={() => {
          if (confirm(t('sync.deleteConfirm'))) void run(async () => { await sync.deleteAccount(); setMsg({ text: t('sync.deleted') }) }, () => t('sync.error'))
        }}>{t('sync.deleteAccount')}</button>
      </div>
      <p className="muted small top-gap">{t('sync.signOutHint')}</p>
      {msg && <p className={msg.bad ? 'bad-text small' : 'good-text small'} role="alert">{msg.text}</p>}
    </>
  )
}
