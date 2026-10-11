import { useState, type FormEvent } from 'react'
import { PAGES } from '../config'
import { useI18n } from '../i18n/core'
import { useStore } from '../store/context'
import { useSync } from '../sync/context'
import { profilePrompt } from '../sync/profile'
import { ProfileForm } from './ProfileForm'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type Msg = { text: string; bad?: boolean } | null

/** Account: accesso o registrazione (nome, cognome, email, password), profilo facoltativo, sincronizzazione. */
export function AccountSection({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const sync = useSync()
  if (!sync.enabled) return null
  const body = sync.recovery ? <NewPassword /> : sync.user ? <SignedIn /> : <SignInOrUp />
  return compact ? <div className="account-compact">{body}</div>
    : <section className="card" id="account"><h3 className="h-plain">{t('sync.title')}</h3>{body}</section>
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

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  return (
    <span className="pw">
      <input type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={e => onChange(e.target.value)} />
      <button type="button" className="link-btn" onClick={() => setShow(!show)}>{show ? t('auth.hide') : t('auth.show')}</button>
    </span>
  )
}

function SignInOrUp() {
  const { t, lang } = useI18n()
  const sync = useSync()
  const [tab, setTab] = useState<'in' | 'up' | 'link'>('in')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accept, setAccept] = useState(false)
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const { busy, msg, setMsg, run } = useRun()
  const em = email.trim()

  const signIn = (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL.test(em)) { setMsg({ text: t('sync.errEmail'), bad: true }); return }
    void run(() => sync.signIn(em, password), () => t('auth.errLogin'))
  }
  const signUp = (e: FormEvent) => {
    e.preventDefault()
    if (!first.trim() || !last.trim()) { setMsg({ text: t('auth.errName'), bad: true }); return }
    if (!EMAIL.test(em)) { setMsg({ text: t('sync.errEmail'), bad: true }); return }
    if (password.length < 8) { setMsg({ text: t('auth.errPassword'), bad: true }); return }
    if (!accept) { setMsg({ text: t('auth.errAccept'), bad: true }); return }
    void run(async () => {
      const r = await sync.signUp({ firstName: first.trim(), lastName: last.trim(), email: em, password })
      profilePrompt.set()
      if (r.needsConfirm) setMsg({ text: t('auth.confirmSent', { email: em }) })
    }, e => (e.code === 'user_already_exists' ? t('auth.errExists') : e.code === 'weak_password' ? t('auth.errPassword') : t('auth.errGeneric')))
  }
  const forgot = () => {
    if (!EMAIL.test(em)) { setMsg({ text: t('sync.errEmail'), bad: true }); return }
    void run(async () => { await sync.resetPassword(em); setMsg({ text: t('auth.resetSent') }) }, () => t('auth.errGeneric'))
  }
  const sendLink = (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL.test(em)) { setMsg({ text: t('sync.errEmail'), bad: true }); return }
    void run(async () => { await sync.sendCode(em); setCodeSent(true) }, () => t('sync.errSend'))
  }
  const verify = (e: FormEvent) => { e.preventDefault(); void run(() => sync.verifyCode(em, code.trim()), () => t('sync.errCode')) }
  const go = (x: typeof tab) => { setTab(x); setMsg(null) }

  return (
    <>
      <p className="muted small">{t('auth.intro')}</p>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={tab !== 'up'} className={tab !== 'up' ? 'on' : ''} onClick={() => go('in')}>{t('auth.tabSignIn')}</button>
        <button role="tab" aria-selected={tab === 'up'} className={tab === 'up' ? 'on' : ''} onClick={() => go('up')}>{t('auth.tabSignUp')}</button>
      </div>

      {tab === 'up' && (
        <form onSubmit={signUp} className="auth-form">
          <div className="two-col">
            <label className="field"><span>{t('auth.firstName')}</span><input autoComplete="given-name" maxLength={80} value={first} onChange={e => setFirst(e.target.value)} /></label>
            <label className="field"><span>{t('auth.lastName')}</span><input autoComplete="family-name" maxLength={80} value={last} onChange={e => setLast(e.target.value)} /></label>
          </div>
          <label className="field"><span>{t('sync.email')}</span><input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="field"><span>{t('auth.password')}</span><PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
            <small className="muted">{t('auth.passwordHint')}</small></label>
          <label className="check wrap-text"><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} />
            <span>{t('auth.accept')} (<a href={`${PAGES.terms}?lang=${lang}`} target="_blank" rel="noopener">{t('legal.terms')}</a>,{' '}
              <a href={`${PAGES.privacy}?lang=${lang}`} target="_blank" rel="noopener">{t('legal.privacy')}</a>)</span></label>
          <button className="btn primary big-btn" disabled={busy}>{t('auth.signUp')}</button>
        </form>
      )}

      {tab === 'in' && (
        <form onSubmit={signIn} className="auth-form">
          <label className="field"><span>{t('sync.email')}</span><input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="field"><span>{t('auth.password')}</span><PasswordInput value={password} onChange={setPassword} autoComplete="current-password" /></label>
          <button className="btn primary big-btn" disabled={busy}>{t('auth.signIn')}</button>
          <div className="stack-row">
            <button type="button" className="link-btn" disabled={busy} onClick={forgot}>{t('auth.forgot')}</button>
            <button type="button" className="link-btn" onClick={() => go('link')}>{t('auth.useLink')}</button>
          </div>
        </form>
      )}

      {tab === 'link' && (!codeSent ? (
        <form onSubmit={sendLink} className="auth-form">
          <label className="field"><span>{t('sync.email')}</span><input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
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
