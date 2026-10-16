// Segnalazione di chi prova la beta: "Qualcosa non va" o "Un'idea", quanto è importante, cosa è successo,
// screenshot e video (registrati con la registrazione dello schermo del telefono), diagnostica che si può vedere prima.
import { useMemo, useRef, useState } from 'react'
import { acceptFiles, diagnostics, PRIORITIES, sendReport, type Priority, type ReportKind } from '../../beta/reports'
import { useI18n } from '../../i18n/core'
import { useSync } from '../../sync/context'
import { Icon } from '../Icon'
import { tap } from '../kit/motion'

export function ReportForm() {
  const { t } = useI18n()
  const sync = useSync()
  const userId = sync.user?.id ?? null
  const [kind, setKind] = useState<ReportKind>('bug')
  const [priority, setPriority] = useState<Priority>('normal')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [rejected, setRejected] = useState<string[]>([])
  const [withDiagnostics, setWithDiagnostics] = useState(true)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const picker = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => JSON.stringify(diagnostics(), null, 2), [])
  const thumbs = useMemo(() => files.map(f => ({ f, url: URL.createObjectURL(f) })), [files])

  const add = (list: FileList | null) => {
    const r = acceptFiles(files, [...(list ?? [])])
    setFiles(r.files)
    setRejected(r.rejected.map(x => t(x.why === 'size' ? 'rep.tooBig' : x.why === 'count' ? 'rep.tooMany' : 'rep.badType', { name: x.name })))
  }
  async function send() {
    setState('sending')
    try { await sendReport({ kind, priority, message, files, withDiagnostics }, userId); setState('sent') } catch { setState('error') }
  }
  const reset = () => { setMessage(''); setFiles([]); setRejected([]); setPriority('normal'); setState('idle') }

  if (state === 'sent') return (
    <section className="card report" role="status">
      <p className="good-text"><b><Icon name="check" size={16} />{t('rep.thanks')}</b></p>
      <button className="link-btn" onClick={reset}>{t('rep.another')}</button>
    </section>
  )
  return (
    <section className="card report" aria-label={t('prof.feedback')}>
      <div className="chips" role="radiogroup" aria-label={t('rep.kind')}>
        {(['bug', 'idea'] as ReportKind[]).map(k => <button key={k} type="button" role="radio" aria-checked={kind === k} className={`chip${kind === k ? ' on' : ''}`}
          onClick={() => { tap(); setKind(k) }}>{t(`rep.kind.${k}`)}</button>)}
      </div>

      <p className="small fb-q"><b>{t('rep.priority')}</b></p>
      <div className="chips" role="radiogroup" aria-label={t('rep.priority')}>
        {PRIORITIES.map(p => <button key={p} type="button" role="radio" aria-checked={priority === p} className={`chip${priority === p ? ' on' : ''}`}
          onClick={() => { tap(); setPriority(p) }}>{t(`rep.p.${p}`)}</button>)}
      </div>

      <textarea className="fb-text report-text" rows={5} maxLength={4000} value={message} onChange={e => setMessage(e.target.value)}
        placeholder={t(kind === 'bug' ? 'rep.placeholderBug' : 'rep.placeholderIdea')} aria-label={t('rep.describe')} />

      {userId ? <>
        {files.length > 0 && <ul className="report-files">{thumbs.map(({ f, url }) => (
          <li key={url}>
            {f.type.startsWith('video/') ? <video src={url} muted playsInline /> : <img src={url} alt="" />}
            <button className="icon-btn" aria-label={t('rep.remove', { name: f.name })} onClick={() => setFiles(files.filter(x => x !== f))}>×</button>
          </li>))}</ul>}
        <button className="btn small-btn" onClick={() => picker.current?.click()}><Icon name="upload" size={16} />{t('rep.attach')}</button>
        <input ref={picker} type="file" accept="image/*,video/*" multiple hidden onChange={e => { add(e.target.files); e.target.value = '' }} />
        <p className="small muted">{t('rep.attachHint')}</p>
        {rejected.map(r => <p key={r} className="small bad-text">{r}</p>)}
      </> : <p className="small muted">{t('rep.attachLogin')}</p>}

      <label className="check wrap-text"><input type="checkbox" checked={withDiagnostics} onChange={e => setWithDiagnostics(e.target.checked)} />
        <span>{t('rep.diag')}<br /><small className="muted">{t('rep.diagHint')}</small></span></label>
      {withDiagnostics && <details className="report-diag"><summary className="small">{t('rep.diagShow')}</summary><pre>{preview}</pre></details>}

      {userId && <p className="small muted">{t('rep.account')}</p>}
      {state === 'error' && <p className="small bad-text">{t('rep.error')}</p>}
      <button className="btn primary wide" disabled={state === 'sending' || message.trim().length < 3} onClick={() => void send()}>
        {state === 'sending' ? t('rep.sending') : t('rep.send')}</button>
    </section>
  )
}
