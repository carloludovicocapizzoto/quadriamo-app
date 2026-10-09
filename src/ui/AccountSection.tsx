import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/core'
import { useStore } from '../store/context'
import { useSync } from '../sync/context'

/** Accesso con codice via email, stato della sincronizzazione, uscita ed eliminazione dell'account. */
export function AccountSection({ compact = false }: { compact?: boolean }) {
  const { t, date } = useI18n()
  const sync = useSync()
  const { state } = useStore()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)

  if (!sync.enabled) return null

  async function run(fn: () => Promise<void>, errKey: Parameters<typeof t>[0]) {
    setBusy(true); setMsg(null)
    try { await fn() } catch { setMsg({ text: t(errKey), bad: true }) } finally { setBusy(false) }
  }

  if (sync.user) {
    const time = sync.lastSync
      ? `${date(sync.lastSync.slice(0, 10))} ${new Date(sync.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : null
    const statusText = {
      idle: '', syncing: t('sync.syncing'), ok: time ? t('sync.lastSync', { time }) : t('sync.ok'),
      offline: t('sync.offline'), error: t('sync.error'),
    }[sync.status] || (time ? t('sync.lastSync', { time }) : t('sync.never'))
    return (
      <section className="card">
        <h3 className="h-plain">{t('sync.title')}</h3>
        <p>{t('sync.signedInAs', { email: sync.user.email })}</p>
        <p className={`small ${sync.status === 'error' ? 'bad-text' : 'muted'}`} role="status">
          <span className={`dot ${sync.status}`} aria-hidden="true" /> {statusText}</p>
        {state.data?.demo && <p className="muted small">{t('sync.demoHint')}</p>}
        <div className="stack-row">
          <button className="btn" disabled={sync.status === 'syncing'} onClick={() => void sync.syncNow()}>{t('sync.now')}</button>
          <button className="btn" onClick={() => void sync.signOut()}>{t('sync.signOut')}</button>
          <button className="btn danger" onClick={() => {
            if (confirm(t('sync.deleteConfirm'))) void run(async () => { await sync.deleteAccount(); setMsg({ text: t('sync.deleted') }) }, 'sync.error')
          }}>{t('sync.deleteAccount')}</button>
        </div>
        <p className="muted small top-gap">{t('sync.signOutHint')}</p>
        {msg && <p className={msg.bad ? 'bad-text small' : 'good-text small'} role="alert">{msg.text}</p>}
      </section>
    )
  }

  const sendCode = (e: FormEvent) => {
    e.preventDefault()
    const em = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setMsg({ text: t('sync.errEmail'), bad: true }); return }
    void run(async () => { await sync.sendCode(em); setStep('code') }, 'sync.errSend')
  }
  const verify = (e: FormEvent) => {
    e.preventDefault()
    void run(() => sync.verifyCode(email.trim(), code.trim()), 'sync.errCode')
  }

  return (
    <section className={compact ? 'account-compact' : 'card'}>
      {!compact && <h3 className="h-plain">{t('sync.title')}</h3>}
      <p className="muted small">{t('sync.intro')}</p>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="inline-form">
          <label className="field">
            <span>{t('sync.email')}</span>
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy}>{t('sync.sendCode')}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="inline-form">
          <p className="small">{t('sync.codeSent', { email: email.trim() })}</p>
          <label className="field">
            <span>{t('sync.code')}</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code}
                   onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          </label>
          <div className="stack-row">
            <button className="btn primary" disabled={busy || code.length < 6}>{t('sync.verify')}</button>
            <button type="button" className="btn" onClick={() => { setStep('email'); setCode(''); setMsg(null) }}>{t('sync.changeEmail')}</button>
          </div>
        </form>
      )}
      {msg && <p className={msg.bad ? 'bad-text small' : 'good-text small'} role="alert">{msg.text}</p>}
    </section>
  )
}
