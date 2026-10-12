import { useState } from 'react'
import { markFeedbackAsked } from '../../beta/device'
import { sendFeedback, type Alternative } from '../../beta/feedback'
import { useI18n } from '../../i18n/core'
import { Icon } from '../Icon'
import { PushToggle } from './PushToggle'

/** Richiesta di feedback: voto da 1 a 5 e un commento. Compare ogni 10 giorni, o dal link della notifica. */
export function FeedbackCard({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n()
  const [rating, setRating] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [alt, setAlt] = useState<Alternative | null>(null)
  const [altOther, setAltOther] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function send() {
    setState('sending')
    try { await sendFeedback(rating, text, lang, alt, altOther); setState('sent') } catch { setState('error') }
  }
  if (state === 'sent') return (
    <section className="card feedback" role="status">
      <p className="good-text"><b><Icon name="check" size={16} />{t('fb.thanks')}</b></p>
      <PushToggle compact />
      <button className="link-btn" onClick={onClose}>{t('action.close')}</button>
    </section>
  )
  return (
    <section className="card feedback" aria-labelledby="fb-title">
      <h3 id="fb-title" className="h-plain">{t('fb.title')}</h3>
      <p className="small muted">{t('fb.text')}</p>
      <div className="stars" role="radiogroup" aria-label={t('fb.rate')}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n}/5`}
                  className={`star${rating != null && n <= rating ? ' on' : ''}`} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <p className="small fb-q"><b>{t('fb.altQ')}</b></p>
      <div className="chips">
        {(['nothing', 'spreadsheet', 'notes', 'bank_app', 'other_app'] as Alternative[]).map(a => (
          <button key={a} type="button" className={`chip${alt === a ? ' on' : ''}`} aria-pressed={alt === a} onClick={() => setAlt(alt === a ? null : a)}>
            {t(`fb.alt.${a}`)}</button>
        ))}
      </div>
      {alt === 'other_app' && <input className="fb-text" maxLength={120} value={altOther} onChange={e => setAltOther(e.target.value)} placeholder={t('fb.altWhich')} />}
      <textarea className="fb-text" rows={3} maxLength={4000} value={text} onChange={e => setText(e.target.value)}
                placeholder={t('fb.placeholder')} aria-label={t('fb.placeholder')} />
      {state === 'error' && <p className="small bad-text">{t('fb.error')}</p>}
      <div className="stack-row">
        <button className="btn primary small-btn" disabled={state === 'sending' || (rating == null && !text.trim() && !alt)} onClick={send}>
          {t('fb.send')}</button>
        <button className="btn small-btn" onClick={() => { markFeedbackAsked(); onClose() }}>{t('fb.later')}</button>
      </div>
    </section>
  )
}
